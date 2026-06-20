import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  batch: {
    getAll: () => ipcRenderer.invoke('batch:getAll'),
    getByStatus: (status: string) => ipcRenderer.invoke('batch:getByStatus', status),
    create: (data: any) => ipcRenderer.invoke('batch:create', data),
    delete: (id: number) => ipcRenderer.invoke('batch:delete', id),
  },
  sampling: {
    getAll: () => ipcRenderer.invoke('sampling:getAll'),
    getByBatchId: (batchId: number) => ipcRenderer.invoke('sampling:getByBatchId', batchId),
    getPendingSend: () => ipcRenderer.invoke('sampling:getPendingSend'),
    getOverdue: () => ipcRenderer.invoke('sampling:getOverdue'),
    create: (data: any) => ipcRenderer.invoke('sampling:create', data),
    markAsSent: (id: number, sentDate: string) => ipcRenderer.invoke('sampling:markAsSent', id, sentDate),
  },
  report: {
    getAll: () => ipcRenderer.invoke('report:getAll'),
    getByBatchId: (batchId: number) => ipcRenderer.invoke('report:getByBatchId', batchId),
    create: (data: any) => ipcRenderer.invoke('report:create', data),
  },
  photo: {
    save: (dataUrl: string, fileName: string) => ipcRenderer.invoke('photo:save', dataUrl, fileName),
    read: (filePath: string) => ipcRenderer.invoke('photo:read', filePath),
    openDialog: () => ipcRenderer.invoke('dialog:openPhoto'),
  },
});

export type ApiType = {
  batch: {
    getAll: () => Promise<any[]>;
    getByStatus: (status: string) => Promise<any[]>;
    create: (data: any) => Promise<number>;
    delete: (id: number) => Promise<void>;
  };
  sampling: {
    getAll: () => Promise<any[]>;
    getByBatchId: (batchId: number) => Promise<any[]>;
    getPendingSend: () => Promise<any[]>;
    getOverdue: () => Promise<any[]>;
    create: (data: any) => Promise<number>;
    markAsSent: (id: number, sentDate: string) => Promise<void>;
  };
  report: {
    getAll: () => Promise<any[]>;
    getByBatchId: (batchId: number) => Promise<any[]>;
    create: (data: any) => Promise<number>;
  };
  photo: {
    save: (dataUrl: string, fileName: string) => Promise<string>;
    read: (filePath: string) => Promise<string | null>;
    openDialog: () => Promise<string | null>;
  };
};
