export class UIManager {
    constructor(storage, fileSystem) {
        this.storage = storage;
        this.fileSystem = fileSystem;
        this.bindEvents();
        this.searchTimeout = null;
        this.initializeContextMenu();
        this.activeContextItem = null;
        this.initializeMobileNav();
        this.selectedFiles = new Set();
        this.initializeToolbar();
        this.initializeDetailsPanel();
    }

    bindEvents() {
        document.getElementById('upload-btn').addEventListener('click', () => this.handleUpload());
        document.getElementById('new-folder-btn').addEventListener('click', () => this.createNewFolder());
        
        const dropZone = document.querySelector('.files-grid');
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            this.handleFileDrop(e.dataTransfer.files);
        });

        document.querySelector('.folder-tree').addEventListener('click', (e) => {
            const folderItem = e.target.closest('.folder-item');
            if (folderItem) {
                const path = folderItem.dataset.path;
                this.fileSystem.currentPath = path;
                this.render();
            }
        });

        document.querySelector('.files-grid').addEventListener('click', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (fileItem) {
                const path = fileItem.dataset.path;
                if (path.endsWith('/')) {
                    this.fileSystem.currentPath = path;
                    this.render();
                } else {
                    this.openFile(path);
                }
            }
        });

        // Add search functionality
        document.getElementById('search-input').addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.handleSearch(e.target.value);
            }, 300);
        });

        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'f': 
                        e.preventDefault();
                        document.getElementById('search-input').focus();
                        break;
                    case 'c': 
                        this.handleCopy();
                        break;
                    case 'v':
                        this.handlePaste();
                        break;
                }
            }
            if (e.key === 'Delete') {
                this.handleDelete();
            }
        });
    }

    render() {
        this.renderFolderTree();
        this.renderFiles();
        this.updateStorageInfo();
    }

    async handleUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            await this.handleFileDrop(files);
        };
        input.click();
    }

    async handleFileDrop(files) {
        try {
            for (const file of files) {
                await this.fileSystem.uploadFile(file);
            }
            this.render();
        } catch (error) {
            console.error('Error handling file drop:', error);
            alert('Error uploading file. Please try again.');
        }
    }

    async createNewFolder() {
        const name = prompt('Enter folder name:');
        if (name) {
            await this.fileSystem.createFolder(this.fileSystem.currentPath, name);
            this.render();
        }
    }

    renderFolderTree() {
        const tree = document.querySelector('.folder-tree');
        tree.innerHTML = this.fileSystem.getFolderTreeHTML();
    }

    renderFiles() {
        const grid = document.querySelector('.files-grid');
        const contents = this.fileSystem.getContents(this.fileSystem.currentPath);
        grid.innerHTML = this.getFilesGridHTML(contents);
    }

    updateStorageInfo() {
        const info = document.querySelector('.storage-info');
        const used = this.storage.getUsedSpace();
        const total = this.storage.getTotalSpace();
        const percentage = (used/total) * 100;
        
        info.innerHTML = `
            <div class="storage-info-button" role="button" tabindex="0">
                <h2 class="storage-title">
                    <i class="fas fa-hard-drive"></i>
                    <span>Storage Space</span>
                </h2>
                <div class="storage-bar">
                    <div class="used" style="width: ${percentage}%"></div>
                </div>
                <div class="storage-text">
                    <i class="fas fa-chart-pie"></i>
                    <strong>${this.formatSize(used)}</strong> used of <strong>${this.formatSize(total)}</strong>
                    <div class="storage-percentage">${percentage.toFixed(1)}% used</div>
                </div>
            </div>
        `;

        info.querySelector('.storage-info-button').addEventListener('click', () => this.showStorageDetails());
    }

    showStorageDetails() {
        const usageByType = this.analyzeStorageUsage();
        const dialog = document.createElement('dialog');
        dialog.className = 'storage-details-dialog';
        
        dialog.innerHTML = `
            <div class="storage-details">
                <div class="storage-details-header">
                    <h2>Storage Details</h2>
                    <button class="close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="storage-usage-details">
                    <div class="usage-chart">
                        ${this.generateUsageChart(usageByType)}
                    </div>
                    <div class="usage-list">
                        ${Object.entries(usageByType).map(([type, size]) => `
                            <div class="usage-item ${type.toLowerCase()}">
                                <i class="fas ${this.getTypeIcon(type)}"></i>
                                <span class="type-name">${type}</span>
                                <span class="type-size">${this.formatSize(size)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="storage-upgrade">
                    <h3>Need More Space?</h3>
                    <div class="upgrade-options">
                        <div class="upgrade-plan">
                            <h4>Pro Plan</h4>
                            <div class="price">$9.99/month</div>
                            <ul>
                                <li>100 GB Storage</li>
                                <li>Priority Support</li>
                                <li>Advanced Sharing</li>
                            </ul>
                            <button class="upgrade-btn">Upgrade Now</button>
                        </div>
                        <div class="upgrade-plan premium">
                            <h4>Enterprise</h4>
                            <div class="price">$24.99/month</div>
                            <ul>
                                <li>1 TB Storage</li>
                                <li>24/7 Support</li>
                                <li>Advanced Security</li>
                            </ul>
                            <button class="upgrade-btn">Contact Sales</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);
        dialog.showModal();

        dialog.querySelector('.close-btn').addEventListener('click', () => {
            dialog.close();
        });

        dialog.addEventListener('close', () => {
            dialog.remove();
        });
    }

    analyzeStorageUsage() {
        const filesystem = JSON.parse(localStorage.getItem('filesystem'));
        const usage = {
            'Documents': 0,
            'Images': 0,
            'Videos': 0,
            'Audio': 0,
            'Others': 0
        };

        const analyzeNode = (node) => {
            if (node.type === 'file') {
                const type = this.getFileCategory(node.mimeType);
                usage[type] += node.size || 0;
            }
            if (node.children) {
                node.children.forEach(analyzeNode);
            }
        };

        analyzeNode(filesystem);
        return usage;
    }

    getFileCategory(mimeType) {
        if (!mimeType) return 'Others';
        if (mimeType.startsWith('image/')) return 'Images';
        if (mimeType.startsWith('video/')) return 'Videos';
        if (mimeType.startsWith('audio/')) return 'Audio';
        if (mimeType.includes('pdf') || 
            mimeType.includes('document') || 
            mimeType.includes('text/')) return 'Documents';
        return 'Others';
    }

    getTypeIcon(type) {
        const icons = {
            'Documents': 'fa-file-lines',
            'Images': 'fa-image',
            'Videos': 'fa-video',
            'Audio': 'fa-music',
            'Others': 'fa-file'
        };
        return icons[type] || 'fa-file';
    }

    generateUsageChart(usage) {
        const total = Object.values(usage).reduce((a, b) => a + b, 0);
        let startAngle = 0;
        const segments = [];

        Object.entries(usage).forEach(([type, size], index) => {
            const percentage = (size / total) * 100;
            const endAngle = startAngle + (percentage * 3.6); // 360 degrees = 100%
            
            segments.push(`
                <div class="chart-segment ${type.toLowerCase()}"
                     style="transform: rotate(${startAngle}deg);
                            clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
                            transform-origin: 100% 50%;
                            animation: fadeIn 0.6s ${index * 0.1}s both;">
                </div>
            `);
            
            startAngle = endAngle;
        });

        return `
            <div class="pie-chart">
                ${segments.join('')}
                <div class="chart-center"></div>
            </div>
        `;
    }

    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    async openFile(path) {
        // Always show preview first
        this.previewFile(path);
    }

    previewFile(path) {
        const file = this.fileSystem.getFile(path);
        if (!file) return;

        const data = localStorage.getItem(file.storageKey);
        if (!data) return;

        const preview = document.createElement('dialog');
        preview.className = 'file-preview fullscreen';
        
        let content = '';
        try {
            if (file.mimeType.startsWith('image/')) {
                content = `<img src="${data}" alt="${file.name}">`;
            } else if (file.mimeType.startsWith('video/')) {
                content = this.createVideoPlayer(data, file.name);
            } else if (file.mimeType.startsWith('audio/')) {
                content = `<audio controls src="${data}"></audio>`;
            } else if (file.mimeType === 'application/pdf') {
                content = `<iframe src="${data}"></iframe>`;
            } else {
                const textContent = data.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                content = `<div class="preview-text"><pre>${textContent}</pre></div>`;
            }
        } catch (error) {
            content = '<div class="preview-error">Error previewing file</div>';
        }

        preview.innerHTML = `
            <div class="preview-toolbar">
                <div class="preview-title">
                    <h3>${file.name}</h3>
                    <span class="preview-meta">${this.formatSize(file.size)} · ${file.mimeType}</span>
                </div>
                <div class="preview-actions">
                    <button class="action-btn download-btn" aria-label="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="action-btn close-btn" aria-label="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="preview-content">${content}</div>
            <a class="download-link hidden" href="${data}" download="${file.name}"></a>
        `;

        document.body.appendChild(preview);
        preview.showModal();

        // Initialize video player if the content is a video
        if (file.mimeType.startsWith('video/')) {
            this.initializeVideoPlayer(preview);
        }

        // Fix button functionality
        preview.querySelector('.download-btn').addEventListener('click', () => {
            preview.querySelector('.download-link').click();
        });

        preview.querySelector('.close-btn').addEventListener('click', () => {
            preview.close();
        });

        // Add touch events for mobile
        let touchStartX = 0;
        let touchEndX = 0;

        preview.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });

        preview.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            if (touchEndX - touchStartX > 100) { // Swipe right to close
                preview.close();
            }
        });

        preview.addEventListener('close', () => {
            preview.remove();
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && preview.open) {
                preview.close();
            }
        });
    }

    createVideoPlayer(src, title) {
        return `
            <div class="custom-video-player">
                <video src="${src}" preload="metadata"></video>
                <div class="video-controls">
                    <button class="video-control-btn play-btn" aria-label="Play">
                        <i class="fas fa-play"></i>
                    </button>
                    <div class="video-progress">
                        <div class="video-progress-filled"></div>
                    </div>
                    <div class="video-time">0:00 / 0:00</div>
                    <div class="video-volume">
                        <button class="video-control-btn volume-btn" aria-label="Mute">
                            <i class="fas fa-volume-up"></i>
                        </button>
                        <div class="volume-slider">
                            <div class="volume-filled"></div>
                        </div>
                    </div>
                    <button class="video-control-btn fullscreen-btn" aria-label="Fullscreen">
                        <i class="fas fa-expand"></i>
                    </button>
                </div>
            </div>
        `;
    }

    initializeVideoPlayer(container) {
        const player = container.querySelector('.custom-video-player');
        const video = player.querySelector('video');
        const playBtn = player.querySelector('.play-btn');
        const progress = player.querySelector('.video-progress');
        const progressBar = player.querySelector('.video-progress-filled');
        const timeDisplay = player.querySelector('.video-time');
        const volumeBtn = player.querySelector('.volume-btn');
        const volumeSlider = player.querySelector('.volume-slider');
        const volumeProgress = player.querySelector('.volume-filled');
        const fullscreenBtn = player.querySelector('.fullscreen-btn');

        // Play/Pause on click anywhere on video
        video.addEventListener('click', () => {
            if (video.paused) {
                video.play();
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            } else {
                video.pause();
                playBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
        });

        // Play/Pause button
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering video click
            if (video.paused) {
                video.play();
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            } else {
                video.pause();
                playBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
        });

        // Update progress bar and time
        video.addEventListener('timeupdate', () => {
            const percent = (video.currentTime / video.duration) * 100;
            progressBar.style.width = `${percent}%`;
            timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
        });

        // Click on progress bar
        progress.addEventListener('click', (e) => {
            const rect = progress.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            video.currentTime = percent * video.duration;
        });

        // Volume controls
        volumeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            video.muted = !video.muted;
            volumeBtn.innerHTML = `<i class="fas fa-volume-${video.muted ? 'mute' : 'up'}"></i>`;
            volumeProgress.style.width = video.muted ? '0%' : `${video.volume * 100}%`;
        });

        volumeSlider.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = volumeSlider.getBoundingClientRect();
            const volume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            video.volume = volume;
            video.muted = false;
            volumeProgress.style.width = `${volume * 100}%`;
            volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        });

        // Fullscreen
        fullscreenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!document.fullscreenElement) {
                player.requestFullscreen().catch(err => {
                    // Fallback for browsers that don't support requestFullscreen
                    if (player.webkitRequestFullscreen) {
                        player.webkitRequestFullscreen();
                    } else if (player.mozRequestFullScreen) {
                        player.mozRequestFullScreen();
                    }
                });
                fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
            } else {
                document.exitFullscreen().catch(err => {
                    // Fallback for browsers that don't support exitFullscreen
                    if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    } else if (document.mozCancelFullScreen) {
                        document.mozCancelFullScreen();
                    }
                });
                fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
            }
        });

        // Update fullscreen button icon when fullscreen changes
        document.addEventListener('fullscreenchange', () => {
            fullscreenBtn.innerHTML = `<i class="fas fa-${document.fullscreenElement ? 'compress' : 'expand'}"></i>`;
        });

        // Show controls when moving mouse over video
        let timeout;
        player.addEventListener('mousemove', () => {
            const controls = player.querySelector('.video-controls');
            controls.style.opacity = '1';
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (!video.paused) {
                    controls.style.opacity = '0';
                }
            }, 2000);
        });

        // Format time helper
        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };
    }

    async handleSearch(query) {
        if (!query) {
            this.render(); // Return to normal view if search is empty
            return;
        }
        
        const results = await this.fileSystem.searchFiles(query);
        this.renderSearchResults(results);
        this.updateSearchUI(query, results.length);
    }

    renderSearchResults(results) {
        const grid = document.querySelector('.files-grid');
        if (!results.length) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search empty-icon"></i>
                    <h3>No results found</h3>
                    <p>Try different keywords or check the spelling</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = results.map(item => `
            <div class="file-item ${this.fileSystem.favorites.has(item.path) ? 'favorite' : ''}" data-path="${item.path}">
                ${this.fileSystem.favorites.has(item.path) ? '<i class="fas fa-star favorite-badge"></i>' : ''}
                <div class="file-type-indicator">${this.getFileType(item)}</div>
                <i class="fas ${item.type === 'folder' ? 'fa-folder' : this.fileSystem.getFileIcon(item.mimeType)}"></i>
                <div class="file-name" title="${item.name}">${this.truncateFileName(item.name)}</div>
                <div class="file-info">
                    <span class="file-size">${this.formatSize(item.size || 0)}</span>
                    <span class="file-path">${item.path}</span>
                </div>
            </div>
        `).join('');
    }

    updateSearchUI(query, resultCount) {
        const searchInput = document.getElementById('search-input');
        searchInput.setAttribute('aria-label', `Found ${resultCount} results for "${query}"`);
        
        // Update the toolbar to show we're in search mode
        const toolbar = document.querySelector('.toolbar');
        const existingClear = toolbar.querySelector('.clear-search');
        if (!existingClear) {
            toolbar.insertAdjacentHTML('afterbegin', `
                <button class="clear-search">
                    <i class="fas fa-times"></i>
                    <span>Clear Search</span>
                </button>
            `);
            
            toolbar.querySelector('.clear-search').addEventListener('click', () => {
                searchInput.value = '';
                this.render();
                toolbar.querySelector('.clear-search').remove();
            });
        }
    }

    getFilesGridHTML(contents) {
        if (!contents?.length) {
            return `
                <div class="empty-state">
                    <i class="fas fa-folder-open empty-icon"></i>
                    <h3>No files here yet</h3>
                    <p>Drop files here or use the upload button</p>
                </div>
            `;
        }

        return contents.map(item => this.renderFileItem(item)).join('');
    }

    truncateFileName(name, maxLength = 20) {
        if (!name) return '';
        if (name.length <= maxLength) return name;

        const ext = name.split('.').pop();
        const base = name.slice(0, -ext.length - 1);
        const truncatedBase = base.slice(0, maxLength - ext.length - 4) + '...';
        return `${truncatedBase}.${ext}`;
    }

    renderFileItem(item) {
        if (!item) return '';
        
        const isFavorite = this.fileSystem.favorites.has(item.path);
        const isRecent = this.fileSystem.recentFiles.some(f => f.path === item.path);
        
        return `
            <div class="file-item ${isFavorite ? 'favorite' : ''} ${isRecent ? 'recent' : ''}" 
                 data-path="${item.path}"
                 draggable="true">
                ${isFavorite ? '<i class="fas fa-star favorite-badge"></i>' : ''}
                ${isRecent ? '<span class="recent-badge">Recent</span>' : ''}
                <div class="file-type-indicator">${this.getFileType(item)}</div>
                <i class="fas ${item.type === 'folder' ? 'fa-folder' : this.fileSystem.getFileIcon(item.mimeType)}"></i>
                <div class="file-name" title="${item.name}">${this.truncateFileName(item.name)}</div>
                <div class="file-info">
                    <span class="file-size">${this.formatSize(item.size || 0)}</span>
                    ${item.lastModified ? `
                        <span class="file-date">${new Date(item.lastModified).toLocaleDateString()}</span>
                    ` : ''}
                </div>
            </div>
        `;
    }

    initializeContextMenu() {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="menu-item" data-action="preview">
                <i class="fas fa-eye"></i>
                <span>Preview</span>
            </div>
            <div class="menu-item" data-action="share">
                <i class="fas fa-share-nodes"></i>
                <span>Share</span>
            </div>
            <div class="menu-item" data-action="download">
                <i class="fas fa-download"></i>
                <span>Download</span>
            </div>
            <div class="menu-separator"></div>
            <div class="menu-item" data-action="rename">
                <i class="fas fa-pen"></i>
                <span>Rename</span>
            </div>
            <div class="menu-item" data-action="move">
                <i class="fas fa-arrows-up-down-left-right"></i>
                <span>Move to</span>
            </div>
            <div class="menu-separator"></div>
            <div class="menu-item danger" data-action="delete">
                <i class="fas fa-trash"></i>
                <span>Delete</span>
            </div>
        `;
        document.body.appendChild(menu);

        // Hide menu on click outside
        document.addEventListener('click', () => this.hideContextMenu());
        
        // Prevent context menu from being hidden when clicking inside it
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = e.target.dataset.action;
            if (action) {
                this.handleContextMenuAction(action);
                this.hideContextMenu();
            }
        });

        // Add context menu trigger
        document.addEventListener('contextmenu', (e) => {
            const fileItem = e.target.closest('.file-item');
            const folderItem = e.target.closest('.folder-item');
            if (fileItem || folderItem) {
                e.preventDefault();
                this.activeContextItem = fileItem || folderItem;
                this.showContextMenu(e.pageX, e.pageY);
            }
        });

        this.updateContextMenu();
    }

    showContextMenu(x, y) {
        const menu = document.querySelector('.context-menu');
        menu.style.display = 'block';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        // Ensure menu stays within viewport
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${y - rect.height}px`;
        }
    }

    hideContextMenu() {
        const menu = document.querySelector('.context-menu');
        menu.style.display = 'none';
        this.activeContextItem = null;
    }

    async handleContextMenuAction(action) {
        if (!this.activeContextItem) return;
        const path = this.activeContextItem.dataset.path;

        switch(action) {
            case 'open':
                this.openFile(path);
                break;
            case 'preview':
                this.previewFile(path);
                break;
            case 'download':
                this.downloadFile(path);
                break;
            case 'share':
                await this.handleShare(path);
                break;
            case 'rename':
                await this.handleRename(path);
                break;
            case 'delete':
                await this.handleDelete(path);
                break;
            case 'copy':
                this.handleCopy(path);
                break;
            case 'cut':
                this.handleCut(path);
                break;
            case 'favorite':
                this.fileSystem.toggleFavorite(path);
                this.render();
                break;
            case 'versions':
                this.showVersionHistory(path);
                break;
            case 'trash':
                this.fileSystem.moveToTrash(path);
                this.render();
                break;
        }
    }

    async handleRename(path) {
        const item = this.fileSystem.getFile(path);
        if (!item) return;

        const newName = prompt('Enter new name:', item.name);
        if (newName && newName !== item.name) {
            await this.fileSystem.renameItem(path, newName);
            this.render();
        }
    }

    downloadFile(path) {
        const file = this.fileSystem.getFile(path);
        if (!file || !file.storageKey) return;

        const data = localStorage.getItem(file.storageKey);
        if (!data) {
            console.error('File data not found:', file);
            return;
        }

        const a = document.createElement('a');
        if (data.startsWith('data:')) {
            a.href = data;
        } else {
            // Handle text files
            const blob = new Blob([data], { type: file.mimeType });
            a.href = URL.createObjectURL(blob);
        }
        a.download = file.name;
        a.click();
        
        if (!data.startsWith('data:')) {
            URL.revokeObjectURL(a.href);
        }
    }

    async handleDelete() {
        const selected = this.getSelectedItems();
        if (selected.length && confirm('Are you sure you want to delete selected items?')) {
            for (const item of selected) {
                await this.fileSystem.deleteItem(item.dataset.path);
            }
            this.render();
        }
    }

    async handleShare(path) {
        const shareLink = await this.fileSystem.generateShareLink(path);
        const dialog = document.createElement('dialog');
        dialog.innerHTML = `
            <h3>Share File</h3>
            <input type="text" value="${shareLink}" readonly>
            <button onclick="this.closest('dialog').close()">Close</button>
        `;
        document.body.appendChild(dialog);
        dialog.showModal();
    }

    initializeSearchBar() {
        const searchContainer = document.querySelector('.search-container');
        searchContainer.innerHTML = `
            <div class="search-wrapper">
                <i class="fas fa-search"></i>
                <input type="text" id="search-input" class="search-input" placeholder="Search files and folders...">
            </div>
        `;
    }

    createSortDropdown() {
        const sortDropdown = document.createElement('div');
        sortDropdown.className = 'sort-dropdown';
        sortDropdown.innerHTML = `
            <button class="sort-button">
                <i class="fas fa-sort"></i>
                <span>Sort</span>
            </button>
            <div class="sort-menu">
                <div class="menu-item" data-sort="name">
                    <i class="fas fa-font"></i>
                    <span>Name</span>
                </div>
                <div class="menu-item" data-sort="size">
                    <i class="fas fa-weight"></i>
                    <span>Size</span>
                </div>
                <div class="menu-item" data-sort="date">
                    <i class="fas fa-calendar"></i>
                    <span>Date</span>
                </div>
            </div>
        `;
        document.querySelector('.toolbar').appendChild(sortDropdown);

        // Add sort functionality
        sortDropdown.addEventListener('click', (e) => {
            const sortBy = e.target.closest('.menu-item')?.dataset.sort;
            if (sortBy) this.sortFiles(sortBy);
        });
    }

    sortFiles(by) {
        this.fileSystem.sortBy = by;
        this.render();
    }

    initializeMobileNav() {
        const toggle = document.querySelector('.mobile-nav-toggle');
        const sidebar = document.querySelector('.sidebar');
        
        toggle?.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            toggle.querySelector('i').classList.toggle('fa-bars');
            toggle.querySelector('i').classList.toggle('fa-times');
        });

        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                !e.target.closest('.sidebar') && 
                !e.target.closest('.mobile-nav-toggle') && 
                sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                toggle.querySelector('i').classList.add('fa-bars');
                toggle.querySelector('i').classList.remove('fa-times');
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('active');
            }
        });
    }

    initializeToolbar() {
        // Only initialize if elements exist
        const toolbar = document.querySelector('.toolbar');
        if (!toolbar) return;

        toolbar.insertAdjacentHTML('beforeend', `
            <div class="view-controls">
                <button class="view-toggle" title="Change view">
                    <i class="fas fa-${this.fileSystem.viewMode === 'grid' ? 'list' : 'grid-2'}"></i>
                </button>
                <div class="view-separator"></div>
                <button class="favorites-btn" title="Show favorites">
                    <i class="fas fa-star"></i>
                </button>
                <button class="recents-btn" title="Show recent files">
                    <i class="fas fa-clock"></i>
                </button>
                <button class="trash-btn" title="Show trash">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `);

        // View toggle
        toolbar.querySelector('.view-toggle').addEventListener('click', () => {
            this.fileSystem.viewMode = this.fileSystem.viewMode === 'grid' ? 'list' : 'grid';
            document.querySelector('.files-grid').classList.toggle('list-view');
            this.render();
        });

        // Favorites view
        toolbar.querySelector('.favorites-btn').addEventListener('click', () => {
            this.showFavorites();
        });

        // Recent files
        toolbar.querySelector('.recents-btn').addEventListener('click', () => {
            this.showRecents();
        });

        // Trash
        toolbar.querySelector('.trash-btn').addEventListener('click', () => {
            this.showTrash();
        });
    }

    showFavorites() {
        const favorites = this.fileSystem.getFavorites();
        this.renderCustomView(favorites, 'Favorites', 'star');
    }

    showRecents() {
        const recents = this.fileSystem.getRecentFiles();
        this.renderCustomView(recents, 'Recent Files', 'clock');
    }

    showTrash() {
        const trashedFiles = this.fileSystem.getTrash();
        this.renderCustomView(trashedFiles, 'Trash', 'trash', true);
    }

    renderCustomView(items, title, icon, isTrash = false) {
        const main = document.querySelector('.content');
        main.innerHTML = `
            <div class="custom-view-header">
                <h2><i class="fas fa-${icon}"></i> ${title}</h2>
                ${isTrash ? `
                    <button class="empty-trash-btn" ${items.length ? '' : 'disabled'}>
                        Empty Trash
                    </button>
                ` : ''}
            </div>
            <div class="files-grid ${this.fileSystem.viewMode === 'list' ? 'list-view' : ''}">
                ${items.length ? items.map(item => this.renderFileItem(item)).join('') : `
                    <div class="empty-state">
                        <i class="fas fa-${icon} empty-icon"></i>
                        <h3>No ${title.toLowerCase()} yet</h3>
                    </div>
                `}
            </div>
        `;

        if (isTrash && items.length) {
            main.querySelector('.empty-trash-btn').addEventListener('click', () => {
                if (confirm('Are you sure you want to permanently delete all items in trash?')) {
                    this.fileSystem.emptyTrash();
                    this.showTrash();
                }
            });
        }
    }

    initializeDetailsPanel() {
        const panel = document.createElement('div');
        panel.className = 'details-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <h3>Details</h3>
                <button class="close-panel">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="panel-content"></div>
        `;
        document.querySelector('.content').appendChild(panel);
    }

    updateContextMenu() {
        // Extend the context menu with new options
        const menuItems = [
            { icon: 'fa-star', text: 'Add to favorites', action: 'favorite' },
            { icon: 'fa-history', text: 'View versions', action: 'versions' },
            { icon: 'fa-trash', text: 'Move to trash', action: 'trash', class: 'danger' }
        ];

        const menu = document.querySelector('.context-menu');
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = `menu-item ${item.class || ''}`;
            menuItem.dataset.action = item.action;
            menuItem.innerHTML = `
                <i class="fas ${item.icon}"></i>
                <span>${item.text}</span>
            `;
            menu.appendChild(menuItem);
        });
    }

    showFileDetails(file) {
        const panel = document.querySelector('.details-panel');
        const content = panel.querySelector('.panel-content');
        
        content.innerHTML = `
            <div class="file-preview-thumb">
                ${this.getFilePreviewThumb(file)}
            </div>
            <div class="file-details">
                <h4>${file.name}</h4>
                <div class="detail-item">
                    <span class="label">Type:</span>
                    <span>${file.mimeType || 'Folder'}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Size:</span>
                    <span>${this.formatSize(file.size || 0)}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Modified:</span>
                    <span>${new Date(file.lastModified).toLocaleString()}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Location:</span>
                    <span>${file.path}</span>
                </div>
            </div>
            <div class="file-actions">
                <button class="action-btn" onclick="handleShare('${file.path}')">
                    <i class="fas fa-share-nodes"></i> Share
                </button>
                <button class="action-btn" onclick="toggleFavorite('${file.path}')">
                    <i class="fas fa-star"></i> Favorite
                </button>
            </div>
        `;

        panel.classList.add('active');
    }

    getFileType(item) {
        if (!item) return 'Unknown';
        if (item.type === 'folder') return 'Folder';
        const ext = item.name.split('.').pop().toLowerCase();
        return ext.toUpperCase() || 'File';
    }
}
