export class StorageManager {
    constructor() {
        this.prefix = 'nova_central_';
        this.trustedDomains = [
            'docs.nova.xxavvgroup.com',
            'present.nova.xxavvgroup.com',
            'gists.nova.xxavvgroup.com',
            'calendar.nova.xxavvgroup.com',
        ];
        this.syncDomains = [
            'docs.nova.xxavvgroup.com',
            'present.nova.xxavvgroup.com',
            'gists.nova.xxavvgroup.com',
            'calendar.nova.xxavvgroup.com'
        ];
    }

    async init() {
        await this.syncExternalStorage();
        await this.importExternalData();
    }

    async importExternalData() {
        try {
            // Import data from other Nova apps
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (this.isExternalNovaData(key)) {
                    const value = localStorage.getItem(key);
                    await this.importFile(key, value);
                }
            }
        } catch (error) {
            console.error('Error importing external data:', error);
        }
    }

    isExternalNovaData(key) {
        return this.syncDomains.some(domain => 
            key.startsWith(`nova_${domain}_`) && 
            !key.startsWith(this.prefix)
        );
    }

    async importFile(key, value) {
        try {
            const fileName = key.split('_').pop();
            const fileData = {
                name: fileName,
                type: 'file',
                size: value.length,
                mimeType: this.getMimeType(fileName),
                path: `/imported/${fileName}`,
                storageKey: `imported_${Date.now()}_${fileName}`
            };

            this.setItem(fileData.storageKey, value);
            await this.fileSystem.addImportedFile(fileData);
        } catch (error) {
            console.error('Error importing file:', error);
        }
    }

    getMimeType(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const mimeTypes = {
            pdf: 'application/pdf',
            doc: 'application/msword',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xls: 'application/vnd.ms-excel',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ppt: 'application/vnd.ms-powerpoint',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif'
        };
        return mimeTypes[ext] || 'application/octet-stream';
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
        return 10 * 1024 * 1024; // 10MB default limit
    }

    handleExternalChange(event) {
        if (event.data.key && event.data.value) {
            localStorage.setItem(this.prefix + event.data.key, event.data.value);
        }
    }
}
