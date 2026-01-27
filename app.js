window.App = {
    state: {
        currentView: 'settings-view',
        notes: [],
        currentNote: null,
        config: {
            owner: '',
            repo: '',
            token: ''
        }
    },

    init() {
        try {
            console.log("App init started");
            this.cacheDom();
            this.loadConfig();
            this.bindEvents();

            if (this.isConfigValid()) {
                console.log("Config valid, going to list");
                this.router('list-view');
                this.fetchNotes();
            } else {
                console.log("Config invalid, going to settings");
                this.router('settings-view');
            }
        } catch (e) {
            alert("Chyba pri štarte aplikácie: " + e.message + "\n" + e.stack);
            console.error(e);
        }
    },

    cacheDom() {
        this.dom = {
            views: document.querySelectorAll('.view'),
            navTitle: document.getElementById('nav-title'),
            btnBack: document.getElementById('btn-back'),
            btnAdd: document.getElementById('btn-add'),
            btnSettings: document.getElementById('btn-settings'),
            btnSave: document.getElementById('btn-save'),
            btnDeleteNav: document.getElementById('btn-delete-nav'),
            btnEdit: document.getElementById('btn-edit'),

            // Settings
            inputOwner: document.getElementById('conf-owner'),
            inputRepo: document.getElementById('conf-repo'),
            inputToken: document.getElementById('conf-token'),
            btnSaveConfig: document.getElementById('btn-save-config'),

            // List
            listContainer: document.getElementById('notes-list'),
            spinner: document.getElementById('spinner'),

            // Editor
            inputTitle: document.getElementById('note-title'),
            inputBody: document.getElementById('note-body'),
            previewFilename: document.getElementById('filename-preview'),

            // Detail
            detailContent: document.getElementById('detail-content')
        };

        // Debug check
        for (const [key, element] of Object.entries(this.dom)) {
            if (!element) console.warn("Missing DOM element:", key);
        }
    },

    bindEvents() {
        if (!this.dom.btnSettings) return; // Basic validation

        // Navigation
        this.dom.btnSettings.addEventListener('click', () => this.router('settings-view'));
        this.dom.btnAdd.addEventListener('click', () => this.openEditor());
        this.dom.btnBack.addEventListener('click', () => this.goBack());

        // Settings
        this.dom.btnSaveConfig.addEventListener('click', () => this.saveConfig());

        // Editor
        this.dom.inputTitle.addEventListener('input', () => this.updateFilenamePreview());
        this.dom.btnSave.addEventListener('click', () => this.saveNote());
        this.dom.btnDeleteNav.addEventListener('click', () => this.deleteNote());
        this.dom.btnEdit.addEventListener('click', () => this.startEditing());
    },

    // --- Configuration ---
    loadConfig() {
        this.state.config.owner = localStorage.getItem('owner') || '';
        this.state.config.repo = localStorage.getItem('repo') || '';
        // Sanitize token immediately on load to fix "bad" cached tokens
        this.state.config.token = (localStorage.getItem('token') || '').replace(/\s/g, '');

        if (this.dom.inputOwner) this.dom.inputOwner.value = this.state.config.owner;
        if (this.dom.inputRepo) this.dom.inputRepo.value = this.state.config.repo;
        if (this.dom.inputToken) this.dom.inputToken.value = this.state.config.token;
    },

    saveConfig() {
        const owner = this.dom.inputOwner.value.trim();
        const repo = this.dom.inputRepo.value.trim();
        // Remove ALL whitespace from token, just in case
        const token = this.dom.inputToken.value.replace(/\s/g, '');

        if (!owner || !repo || !token) {
            alert('Vyplňte všetky polia.');
            return;
        }

        localStorage.setItem('owner', owner);
        localStorage.setItem('repo', repo);
        localStorage.setItem('token', token);

        this.state.config = { owner, repo, token };
        this.router('list-view');
        this.fetchNotes();
    },

    isConfigValid() {
        return this.state.config.owner && this.state.config.repo && this.state.config.token;
    },

    // --- Navigation ---
    router(viewId) {
        console.log("Routing to:", viewId);
        // Reset header
        this.dom.btnBack.style.display = 'none';
        this.dom.btnSettings.style.display = 'none';
        this.dom.btnAdd.style.display = 'none';
        this.dom.btnSave.style.display = 'none';
        this.dom.btnDeleteNav.style.display = 'none';
        this.dom.btnEdit.style.display = 'none';

        // View transitions
        this.dom.views.forEach(v => v.classList.remove('active'));
        const activeView = document.getElementById(viewId);
        if (activeView) activeView.classList.add('active');
        else console.error("View not found:", viewId);

        this.state.currentView = viewId;

        switch (viewId) {
            case 'list-view':
                this.dom.navTitle.innerText = 'GitNotes';
                this.dom.btnSettings.style.display = 'block';
                this.dom.btnAdd.style.display = 'block';
                break;
            case 'settings-view':
                this.dom.navTitle.innerText = 'Nastavenia';
                if (this.isConfigValid()) this.dom.btnBack.style.display = 'block';
                break;
            case 'editor-view':
                this.dom.navTitle.innerText = 'Nová poznámka';
                this.dom.btnBack.style.display = 'block';
                this.dom.btnSave.style.display = 'block';
                break;
            case 'detail-view':
                this.dom.navTitle.innerText = 'Detail';
                this.dom.btnBack.style.display = 'block';
                this.dom.btnDeleteNav.style.display = 'block';
                this.dom.btnEdit.style.display = 'block';
                break;
        }
    },

    goBack() {
        if (this.state.currentView === 'editor-view' || this.state.currentView === 'detail-view' || this.state.currentView === 'settings-view') {
            this.router('list-view');
        }
    },

    // --- Helper: Filenames ---
    formatFilename(title) {
        const date = new Date();
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mi = String(date.getMinutes()).padStart(2, '0');

        const timestamp = `${yyyy}-${mm}-${dd}_${hh}-${mi}`;

        let slug = title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove special chars
            .replace(/\s+/g, '-')     // Spaces to hiphens
            .substring(0, 30);

        if (!slug) slug = 'poznamka';

        return `${timestamp}_${slug}.md`;
    },

    updateFilenamePreview() {
        const title = this.dom.inputTitle.value;
        this.dom.previewFilename.innerText = this.formatFilename(title);
    },

    // --- GitHub API ---
    async fetchNotes() {
        this.dom.spinner.style.display = 'block';
        this.dom.listContainer.innerHTML = '';

        try {
            const { owner, repo, token } = this.state.config;
            if (!owner || !repo || !token) throw new Error("Chýba konfigurácia");

            const url = `https://api.github.com/repos/${owner}/${repo}/contents/notes`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.status === 404) {
                // Folder doesn't exist yet, likely empty.
                this.state.notes = [];
                this.renderList();
                this.dom.spinner.style.display = 'none';
                return;
            }

            if (!response.ok) throw new Error(`Chyba načítania: ${response.status} ${response.statusText}`);

            const data = await response.json();

            this.state.notes = data
                .filter(file => file.name.endsWith('.md'))
                .sort((a, b) => b.name.localeCompare(a.name));

            this.renderList();
        } catch (error) {
            console.error(error);
            let msg = error.message;
            if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
                msg += '\n\n💡 TIP: Toto často spôsobuje:\n1. AdBlock alebo antivírus (vypnite ich pre localhost)\n2. Zlý formát tokenu (skontrolujte medzery)\n3. Žiadne internetové pripojenie';
            }
            // Show error directly in the list
            this.dom.listContainer.innerHTML = `
                <div style="text-align:center; padding: 20px; color: #ff6b6b;">
                    <p>⚠️ ${msg.replace(/\n/g, '<br>')}</p>
                    <button class="btn-primary" onclick="window.App.router('settings-view')">Otvoriť Nastavenia</button>
                    <br><br>
                    <button onclick="window.location.reload()">Skúsiť znova</button>
                </div>
            `;
        } finally {
            this.dom.spinner.style.display = 'none';
        }
    },

    async loadNoteContent(note) {
        this.dom.spinner.style.display = 'block';
        try {
            // Store full note object for delete functionality
            this.state.currentNote = note;

            // We can use the download_url or fetch via API to be safe with CORS
            // Ensure we use the correct URL property
            const fetchUrl = note.git_url || note.url;

            const response = await fetch(fetchUrl, {
                headers: {
                    'Authorization': `token ${this.state.config.token}`,
                    'Accept': 'application/vnd.github.v3.raw' // Raw content
                }
            });

            if (!response.ok) throw new Error(`Chyba obsahu: ${response.status} ${response.statusText}`);
            const text = await response.text();

            // Store raw text for editing
            this.state.currentNoteContentRaw = text;

            // Simple "Markdown" rendering:
            // 1. Headers to H
            // 2. Newlines to BR
            let html = text
                .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                .replace(/\n/gim, '<br>');

            this.dom.detailContent.innerHTML = html;
            this.router('detail-view');
        } catch (e) {
            alert(e.message);
        } finally {
            this.dom.spinner.style.display = 'none';
        }
    },

    async saveNote() {
        const title = this.dom.inputTitle.value.trim();
        const body = this.dom.inputBody.value;

        if (!title) { alert('Zadajte názov'); return; }

        this.dom.btnSave.disabled = true;
        this.dom.btnSave.innerText = 'Ukladám...';

        const { owner, repo, token } = this.state.config;
        let filename = this.formatFilename(title);
        let sha = null;
        let method = 'PUT';

        // If editing, use existing filename and get latest SHA
        if (this.state.isEditing && this.state.currentNote) {
            filename = this.state.currentNote.name;
            // Get latest SHA before saving to prevent conflict
            try {
                const headRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/notes/${filename}`, {
                    headers: { 'Authorization': `token ${token}` }
                });
                if (headRes.ok) {
                    const headData = await headRes.json();
                    sha = headData.sha;
                }
            } catch (e) {
                console.warn("Could not fetch latest SHA, trying with cached one if exists");
                sha = this.state.currentNote.sha;
            }
        }

        const date = new Date().toLocaleString('sk-SK');
        const content = this.state.isEditing ? body : `# ${title}\n\n*${date}*\n\n---\n\n${body}`;

        const contentBase64 = btoa(unescape(encodeURIComponent(content))); // UTF-8 safe base64

        try {
            const url = `https://api.github.com/repos/${owner}/${repo}/contents/notes/${filename}`;
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `${this.state.isEditing ? 'Update' : 'Add'} note: ${title}`,
                    content: contentBase64,
                    sha: sha // Include SHA for updates
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || `Chyba ukladania: ${response.status}`);
            }

            // Success
            this.closeEditor();
            this.router('list-view');
            this.fetchNotes();
        } catch (e) {
            alert('Chyba: ' + e.message);
        } finally {
            this.dom.btnSave.disabled = false;
            this.dom.btnSave.innerText = 'Uložiť';
        }
    },

    async deleteNote() {
        if (!this.state.currentNote) {
            alert('Žiadna poznámka nie je vybraná');
            return;
        }

        const confirmDelete = confirm('Naozaj chcete vymazať túto poznámku? Táto akcia sa nedá vrátiť späť.');
        if (!confirmDelete) return;

        this.dom.spinner.style.display = 'block';

        try {
            const { owner, repo, token } = this.state.config;
            const note = this.state.currentNote;

            // Debug logging
            console.log('Delete note - currentNote:', note);
            console.log('Delete note - owner:', owner, 'repo:', repo);
            console.log('Delete note - note.name:', note.name);

            // Construct the correct API URL for the file
            const fileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/notes/${note.name}`;
            console.log('Delete note - fileUrl:', fileUrl);

            // First, get the file SHA (required for deletion)
            const getResponse = await fetch(fileUrl, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            console.log('Delete note - getResponse status:', getResponse.status);

            if (!getResponse.ok) {
                throw new Error(`Chyba načítania súboru: ${getResponse.status} ${getResponse.statusText}`);
            }

            const fileData = await getResponse.json();
            const sha = fileData.sha;

            console.log('Delete note - SHA:', sha);

            // Delete the file using the same URL
            const deleteResponse = await fetch(fileUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Delete note: ${note.name}`,
                    sha: sha
                })
            });

            console.log('Delete note - deleteResponse status:', deleteResponse.status);

            if (!deleteResponse.ok) {
                const err = await deleteResponse.json();
                throw new Error(err.message || `Chyba vymazania: ${deleteResponse.status}`);
            }

            // Success - go back to list and refresh
            this.state.currentNote = null;
            this.router('list-view');
            this.fetchNotes();
        } catch (e) {
            console.error('Delete note error:', e);
            alert('Chyba pri vymazávaní: ' + e.message);
        } finally {
            this.dom.spinner.style.display = 'none';
        }
    },

    // --- Rendering ---
    renderList() {
        const html = this.state.notes.map((note, index) => {
            const cleanName = note.name.replace('.md', '').split('_').slice(2).join(' ') || note.name;
            const datePart = note.name.split('_').slice(0, 2).join(' ');
            return `
                <li class="note-item" onclick="window.App.loadNoteContent(window.App.state.notes[${index}])">
                    <div class="note-title">${cleanName}</div>
                    <div class="note-date">${datePart}</div>
                </li>
            `;
        }).join('');
        this.dom.listContainer.innerHTML = html;
    },

    openEditor() {
        this.state.isEditing = false;
        this.dom.inputTitle.value = '';
        this.dom.inputBody.value = '';
        this.dom.previewFilename.innerText = '';
        this.dom.inputTitle.disabled = false;
        this.router('editor-view');
    },

    startEditing() {
        if (!this.state.currentNote || !this.state.currentNoteContentRaw) return;

        this.state.isEditing = true;

        // Populate inputs
        const cleanName = this.state.currentNote.name.replace('.md', '').split('_').slice(2).join(' ') || this.state.currentNote.name;
        this.dom.inputTitle.value = cleanName;

        // Strip the header if it exists to just edit the body, or just put the whole thing in?
        // Let's put the whole thing in for now to avoid logic errors with stripping, 
        // OR better yet, just leave the body as is if we want real "editing".
        // Actually, for simple PWA, let's just put the raw markdown in.
        this.dom.inputBody.value = this.state.currentNoteContentRaw;

        this.dom.previewFilename.innerText = this.state.currentNote.name;
        this.dom.inputTitle.disabled = true; // Don't allow changing title (which changes filename) for now

        this.router('editor-view');
        this.dom.navTitle.innerText = 'Upraviť poznámku';
    },

    closeEditor() {
        this.router('list-view');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.App.init();
});
