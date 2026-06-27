// SmartNotes Summarizer - Frontend Script

const API_BASE = "https://smart-notes-1-d1pa.onrender.com/api";

// --- Auth State Management ---
const getToken = () => localStorage.getItem('token');
const getUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

const setSession = (token, user) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

const logout = () => {
  clearSession();
  window.location.href = '/login.html';
};

// Check auth state and redirect if needed
const checkAuth = () => {
  const token = getToken();
  const path = window.location.pathname;
  const isAuthPage = path.includes('login.html') || path.includes('register.html');

  if (!token && !isAuthPage) {
    // Not logged in, accessing dashboard/notes -> redirect to login
    window.location.href = '/login.html';
  } else if (token && isAuthPage) {
    // Logged in, accessing login/register -> redirect to dashboard
    window.location.href = '/dashboard.html';
  }
};

// --- API Helpers ---
const fetchAPI = async (endpoint, options = {}) => {
  const token = getToken();
  
  // Set default headers
  const headers = options.headers || {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Determine if sending JSON or FormData
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Token expired or invalid
    clearSession();
    window.location.href = '/login.html';
    throw new Error('Session expired. Please log in again.');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'An error occurred');
  }

  return data;
};

// --- Toast Notifications ---
const showToast = (message, type = 'success') => {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="toast-close">&times;</button>
  `;

  container.appendChild(toast);

  // Close button click handler
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// --- Loader Helper ---
const toggleLoader = (show, text = 'Processing...') => {
  let loader = document.getElementById('loader-overlay');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'loader-overlay';
    loader.className = 'loader-overlay';
    loader.innerHTML = `
      <div class="spinner"></div>
      <div class="loader-text" id="loader-text">${text}</div>
    `;
    document.body.appendChild(loader);
  } else {
    document.getElementById('loader-text').innerText = text;
  }

  if (show) {
    loader.classList.add('active');
  } else {
    loader.classList.remove('active');
  }
};

// --- Page Specific Logic ---
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  
  // Setup Navbar UI details
  const greetingEl = document.getElementById('user-greeting');
  if (greetingEl) {
    const user = getUser();
    if (user) {
      greetingEl.innerText = `Hello, ${user.username}`;
    }
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }

  // --- Login Page ---
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        toggleLoader(true, 'Logging in...');
        const res = await fetchAPI('/auth/login', {
          method: 'POST',
          body: { email, password }
        });
        setSession(res.token, res.user);
        window.location.href = '/dashboard.html';
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        toggleLoader(false);
      }
    });
  }

  // --- Register Page ---
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      if (password !== confirmPassword) {
        return showToast('Passwords do not match', 'error');
      }

      try {
        toggleLoader(true, 'Registering...');
        const res = await fetchAPI('/auth/register', {
          method: 'POST',
          body: { username, email, password }
        });
        setSession(res.token, res.user);
        showToast('Registration successful!', 'success');
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 1000);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        toggleLoader(false);
      }
    });
  }

  // --- Dashboard Page ---
  const notesGrid = document.getElementById('notes-grid');
  const searchInput = document.getElementById('search-input');
  if (notesGrid) {
    const loadNotes = async (searchQuery = '') => {
      try {
        const endpoint = searchQuery ? `/notes?search=${encodeURIComponent(searchQuery)}` : '/notes';
        const notes = await fetchAPI(endpoint);
        renderNotes(notes);
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    const renderNotes = (notes) => {
      if (notes.length === 0) {
        notesGrid.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <h3>No notes found</h3>
            <p>Get started by creating a new note or uploading a document.</p>
            <a href="/new-note.html" class="btn btn-primary">Create First Note</a>
          </div>
        `;
        return;
      }

      notesGrid.innerHTML = notes.map(note => {
        const dateStr = new Date(note.createdAt).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        
        // Truncate or use fallback for empty summary
        const summaryPreview = note.summary 
          ? note.summary 
          : '<em style="color: var(--text-muted);">No summary generated yet. Click to details and retry.</em>';

        return `
          <div class="note-card ${note.sourceType}" onclick="window.location.href='/note-detail.html?id=${note._id}'">
            <div class="note-card-header">
              <h3 class="note-card-title">${escapeHTML(note.title)}</h3>
              <span class="source-badge ${note.sourceType}">${note.sourceType}</span>
            </div>
            <div class="note-card-summary">${summaryPreview}</div>
            <div class="note-card-footer">
              <span>${dateStr}</span>
              <span style="color: var(--primary);">View details &rarr;</span>
            </div>
          </div>
        `;
      }).join('');
    };

    // Live search with debounce
    let searchDebounce;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          loadNotes(e.target.value);
        }, 300);
      });
    }

    loadNotes();
  }

  // --- New Note Page ---
  const tabPasteBtn = document.getElementById('tab-paste');
  const tabUploadBtn = document.getElementById('tab-upload');
  const panePaste = document.getElementById('pane-paste');
  const paneUpload = document.getElementById('pane-upload');
  
  if (tabPasteBtn && tabUploadBtn) {
    tabPasteBtn.addEventListener('click', () => {
      tabPasteBtn.classList.add('active');
      tabUploadBtn.classList.remove('active');
      panePaste.classList.add('active');
      paneUpload.classList.remove('active');
    });

    tabUploadBtn.addEventListener('click', () => {
      tabUploadBtn.classList.add('active');
      tabPasteBtn.classList.remove('active');
      paneUpload.classList.add('active');
      panePaste.classList.remove('active');
    });
  }

  // Paste Text Form Submit
  const pasteForm = document.getElementById('paste-form');
  if (pasteForm) {
    pasteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('paste-title').value.trim();
      const originalText = document.getElementById('paste-text').value.trim();

      if (!title || !originalText) {
        return showToast('Title and content text are required.', 'error');
      }

      try {
        toggleLoader(true, 'Analyzing text & generating AI summary... (this may take a few seconds)');
        const res = await fetchAPI('/notes', {
          method: 'POST',
          body: { title, originalText }
        });

        if (res.aiFailed) {
          showToast('Note created, but AI summarization failed.', 'warning');
        } else {
          showToast('Note summarized successfully!', 'success');
        }

        setTimeout(() => {
          window.location.href = `/note-detail.html?id=${res.note._id}`;
        }, 1500);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        toggleLoader(false);
      }
    });
  }

  // File Upload Zone interaction
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const fileDisplay = document.getElementById('selected-file-display');
  const fileNameEl = document.getElementById('selected-file-name');
  const removeFileBtn = document.getElementById('remove-file-btn');
  
  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => fileInput.click());

    // Drag events
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
      }, false);
    });

    uploadZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length) {
        handleFileSelect(files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        handleFileSelect(e.target.files[0]);
      }
    });

    const handleFileSelect = (file) => {
      // Validate type
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext !== 'pdf' && ext !== 'docx') {
        return showToast('Invalid file format. Only PDF and DOCX are allowed.', 'error');
      }
      
      // Validate size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        return showToast('File is too large. Max size is 10MB.', 'error');
      }

      fileInput.files = createFileList(file);
      fileNameEl.innerText = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
      fileDisplay.classList.add('active');
    };

    removeFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.value = '';
      fileDisplay.classList.remove('active');
    });
  }

  // File Upload Form Submit
  const uploadForm = document.getElementById('upload-form');
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('upload-title').value.trim();
      const file = fileInput.files[0];

      if (!title) {
        return showToast('Title is required.', 'error');
      }
      if (!file) {
        return showToast('Please select a PDF or DOCX document to upload.', 'error');
      }

      try {
        toggleLoader(true, 'Extracting document text & generating AI summary... (this may take a few seconds)');
        
        const formData = new FormData();
        formData.append('title', title);
        formData.append('document', file);

        const res = await fetchAPI('/notes/upload', {
          method: 'POST',
          body: formData
        });

        if (res.aiFailed) {
          showToast('Document parsed, but AI summarization failed.', 'warning');
        } else {
          showToast('Document parsed and summarized successfully!', 'success');
        }

        setTimeout(() => {
          window.location.href = `/note-detail.html?id=${res.note._id}`;
        }, 1500);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        toggleLoader(false);
      }
    });
  }

  // --- Note Detail Page ---
  const detailContainer = document.getElementById('detail-container');
  if (detailContainer) {
    const urlParams = new URLSearchParams(window.location.search);
    const noteId = urlParams.get('id');

    if (!noteId) {
      window.location.href = '/dashboard.html';
      return;
    }

    const loadNoteDetail = async () => {
      try {
        toggleLoader(true, 'Loading note details...');
        const note = await fetchAPI(`/notes/${noteId}`);
        renderNoteDetail(note);
      } catch (err) {
        showToast(err.message, 'error');
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 2000);
      } finally {
        toggleLoader(false);
      }
    };

    const renderNoteDetail = (note) => {
      const dateStr = new Date(note.createdAt).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Build AI Section HTML
      let aiSectionHTML = '';
      if (!note.summary && (!note.keyPoints || note.keyPoints.length === 0)) {
        // AI Failed or not summarized yet
        aiSectionHTML = `
          <div class="ai-error-box">
            <div class="ai-error-title">AI Summarization Missing</div>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 15px;">
              The AI was unable to generate a summary for this note. This usually happens if the API key is invalid or failed during creation.
            </p>
            <button class="btn btn-accent btn-sm" id="resummarize-btn">
              ✦ Generate AI Summary
            </button>
          </div>
        `;
      } else {
        // Summary succeeded
        aiSectionHTML = `
          <div class="ai-summary-container">
            <div class="ai-summary-text">${escapeHTML(note.summary)}</div>
          </div>
          
          <div class="ai-points-container">
            <div class="ai-points-title">Key takeaways</div>
            <ul class="ai-points-list">
              ${note.keyPoints.map(point => `<li>${escapeHTML(point)}</li>`).join('')}
            </ul>
          </div>
          
          <div style="margin-top: 30px; text-align: right;">
            <button class="btn btn-secondary" id="resummarize-btn" style="font-size: 0.85rem; padding: 6px 12px;">
              ✦ Regenerate Summary
            </button>
          </div>
        `;
      }

      detailContainer.innerHTML = `
        <div style="margin-bottom: 20px;">
          <h2 id="note-view-title" style="font-size: 2.2rem; margin-bottom: 8px;">${escapeHTML(note.title)}</h2>
          <div style="display: flex; gap: 15px; align-items: center; color: var(--text-muted); font-size: 0.9rem;">
            <span>Created on ${dateStr}</span>
            <span class="source-badge ${note.sourceType}">${note.sourceType}</span>
          </div>
        </div>

        <div class="detail-grid">
          <!-- Left Pane: Original Text / Edit Form -->
          <div class="detail-pane">
            <div class="detail-pane-header">
              <div class="detail-pane-title">📝 Note Content</div>
              <button class="btn btn-secondary" id="edit-toggle-btn" style="font-size: 0.85rem; padding: 6px 12px;">
                Edit text
              </button>
            </div>
            
            <!-- Read State -->
            <div class="note-text-display" id="note-text-display">${escapeHTML(note.originalText)}</div>
            
            <!-- Edit State -->
            <form class="note-edit-form" id="note-edit-form">
              <div class="form-group">
                <label for="edit-title">Title</label>
                <input type="text" class="form-control" id="edit-title" value="${escapeHTML(note.title)}" required>
              </div>
              <div class="form-group">
                <label for="edit-text">Content</label>
                <textarea class="form-control" id="edit-text" rows="12" style="resize: vertical;" required>${escapeHTML(note.originalText)}</textarea>
              </div>
              <div style="display: flex; gap: 10px; margin-top: 10px;">
                <button type="submit" class="btn btn-primary">Save changes</button>
                <button type="button" class="btn btn-secondary" id="edit-cancel-btn">Cancel</button>
              </div>
            </form>
          </div>

          <!-- Right Pane: AI Summary -->
          <div class="detail-pane">
            <div class="detail-pane-header">
              <div class="detail-pane-title" style="color: var(--accent-purple);">✦ Smart Summary</div>
            </div>
            <div id="ai-section-content">
              ${aiSectionHTML}
            </div>
          </div>
        </div>

        <div class="detail-actions">
          <button class="btn btn-danger" id="delete-btn">Delete Note</button>
        </div>
      `;

      // Event Listeners for details controls
      const editToggleBtn = document.getElementById('edit-toggle-btn');
      const editCancelBtn = document.getElementById('edit-cancel-btn');
      const textDisplay = document.getElementById('note-text-display');
      const editForm = document.getElementById('note-edit-form');
      const deleteBtn = document.getElementById('delete-btn');
      
      // Toggle edit mode
      if (editToggleBtn && editCancelBtn) {
        const toggleEditMode = (editing) => {
          if (editing) {
            textDisplay.style.display = 'none';
            editToggleBtn.style.display = 'none';
            editForm.classList.add('active');
          } else {
            textDisplay.style.display = 'block';
            editToggleBtn.style.display = 'block';
            editForm.classList.remove('active');
            // reset values
            document.getElementById('edit-title').value = note.title;
            document.getElementById('edit-text').value = note.originalText;
          }
        };

        editToggleBtn.addEventListener('click', () => toggleEditMode(true));
        editCancelBtn.addEventListener('click', () => toggleEditMode(false));
      }

      // Handle Edit Submit
      if (editForm) {
        editForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const title = document.getElementById('edit-title').value.trim();
          const originalText = document.getElementById('edit-text').value.trim();

          if (!title || !originalText) {
            return showToast('Title and content are required.', 'error');
          }

          try {
            toggleLoader(true, 'Saving updates...');
            const res = await fetchAPI(`/notes/${noteId}`, {
              method: 'PUT',
              body: { title, originalText }
            });
            showToast('Note updated successfully.', 'success');
            
            // Reload note details to update view
            note.title = res.note.title;
            note.originalText = res.note.originalText;
            
            // Update static elements
            document.getElementById('note-view-title').innerText = note.title;
            textDisplay.innerText = note.originalText;
            
            // Turn off edit form
            editToggleBtn.click();
          } catch (err) {
            showToast(err.message, 'error');
          } finally {
            toggleLoader(false);
          }
        });
      }

      // Handle Delete Note
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          if (confirm('Are you sure you want to permanently delete this note? This action cannot be undone.')) {
            try {
              toggleLoader(true, 'Deleting note...');
              await fetchAPI(`/notes/${noteId}`, {
                method: 'DELETE'
              });
              showToast('Note deleted successfully.', 'success');
              setTimeout(() => {
                window.location.href = '/dashboard.html';
              }, 1000);
            } catch (err) {
              showToast(err.message, 'error');
              toggleLoader(false);
            }
          }
        });
      }

      // Handle Re-summarize Note
      // Since it's dynamic, bind the listener to container or re-bind on load
      bindResummarizeListener();
    };

    const bindResummarizeListener = () => {
      const resummarizeBtn = document.getElementById('resummarize-btn');
      if (resummarizeBtn) {
        resummarizeBtn.addEventListener('click', async () => {
          try {
            toggleLoader(true, 'AI is summarizing note text... (this may take a few seconds)');
            const res = await fetchAPI(`/notes/${noteId}/resummarize`, {
              method: 'POST'
            });
            showToast('Note summarized successfully!', 'success');
            
            // Re-render whole detail pane or just the AI box to preserve input states
            toggleLoader(false);
            renderNoteDetail(res.note);
          } catch (err) {
            showToast(err.message, 'error');
            toggleLoader(false);
          }
        });
      }
    };

    loadNoteDetail();
  }
});

// --- Helper Functions ---
// Escape HTML to prevent XSS
const escapeHTML = (str) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Create a FileList object for programmatically setting file input values (e.g. for drag-drop)
const createFileList = (file) => {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  return dataTransfer.files;
};
