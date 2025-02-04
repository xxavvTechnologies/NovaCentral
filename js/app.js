import { StorageManager } from './storage.js';
import { UIManager } from './ui.js';
import { FileSystem } from './filesystem.js';

class NovaCentral {
    constructor() {
        this.storage = new StorageManager();
        this.fileSystem = new FileSystem();
        this.ui = new UIManager(this.storage, this.fileSystem);
        this.initialized = false;
    }

    async init() {
        try {
            if (this.initialized) return;
            
            await this.storage.init();
            await this.fileSystem.init();
            this.ui.render();
            this.hideLoading();
            
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
    }

    hideLoading() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
    }
}

const app = new NovaCentral();
app.init();
