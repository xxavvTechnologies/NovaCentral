import { StorageManager } from './storage.js';
import { UIManager } from './ui.js';
import { FileSystem } from './filesystem.js';

class NovaCentral {
    constructor() {
        this.storage = new StorageManager();
        this.fileSystem = new FileSystem();
        this.ui = new UIManager(this.storage, this.fileSystem);
    }

    async init() {
        await this.storage.init();
        await this.fileSystem.init();
        this.ui.render();
        this.hideLoading();
    }

    hideLoading() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
    }
}

const app = new NovaCentral();
app.init();
