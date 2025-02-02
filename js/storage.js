export class StorageManager {
    constructor() {
        this.prefix = 'nova_central_';
        this.trustedDomains = [
            'docs.nova.xxavvgroup.com',
            'present.nova.xxavvgroup.com',
            'gists.nova.xxavvgroup.com',
            'calendar.nova.xxavvgroup.com',
        ];
    }

    async init() {
        this.syncExternalStorage();
    }

    syncExternalStorage() {
        // Use BroadcastChannel API for cross-tab communication
        this.channel = new BroadcastChannel('nova_central_sync');
        this.channel.onmessage = (event) => this.handleExternalChange(event);
    }

    getItem(key) {
        return localStorage.getItem(this.prefix + key);
    }

    setItem(key, value) {
        localStorage.setItem(this.prefix + key, value);
        this.channel.postMessage({ key, value });
    }

    getUsedSpace() {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.prefix)) {
                total += localStorage.getItem(key).length * 2; // UTF-16 characters = 2 bytes
            }
        }
        return total;
    }

    getTotalSpace() {
        return 5 * 1024 * 1024; // 5MB default limit
    }

    handleExternalChange(event) {
        if (event.data.key && event.data.value) {
            localStorage.setItem(this.prefix + event.data.key, event.data.value);
        }
    }
}
