import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  batch: {
    getAll: () => ipcRenderer.invoke('batch:getAll'),
    getByStatus: (status: string) => ipcRenderer.invoke('batch:getByStatus', status),
    create: (data: any, operator?: string) => ipcRenderer.invoke('batch:create', data, operator),
    delete: (id: number) => ipcRenderer.invoke('batch:delete', id),
    getDetail: (id: number) => ipcRenderer.invoke('batch:getDetail', id),
    getMonthlySummary: (yearMonth?: string) => ipcRenderer.invoke('batch:getMonthlySummary', yearMonth),
    getTransferList: (yearMonth: string) => ipcRenderer.invoke('batch:getTransferList', yearMonth),
  },
  sampling: {
    getAll: (keyword?: string) => ipcRenderer.invoke('sampling:getAll', keyword),
    getByBatchId: (batchId: number) => ipcRenderer.invoke('sampling:getByBatchId', batchId),
    getPendingSend: (keyword?: string) => ipcRenderer.invoke('sampling:getPendingSend', keyword),
    getOverdue: () => ipcRenderer.invoke('sampling:getOverdue'),
    create: (data: any, operator?: string) => ipcRenderer.invoke('sampling:create', data, operator),
    markAsSent: (id: number, sentDate: string, operator?: string) => ipcRenderer.invoke('sampling:markAsSent', id, sentDate, operator),
  },
  report: {
    getAll: (keyword?: string) => ipcRenderer.invoke('report:getAll', keyword),
    getByBatchId: (batchId: number) => ipcRenderer.invoke('report:getByBatchId', batchId),
    create: (data: any, operator?: string) => ipcRenderer.invoke('report:create', data, operator),
  },
  disposal: {
    getAll: () => ipcRenderer.invoke('disposal:getAll'),
    getByBatchId: (batchId: number) => ipcRenderer.invoke('disposal:getByBatchId', batchId),
    create: (data: any) => ipcRenderer.invoke('disposal:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('disposal:update', id, data),
  },
  log: {
    getByBatchId: (batchId: number) => ipcRenderer.invoke('log:getByBatchId', batchId),
    create: (batchId: number, action: string, description?: string, operator?: string) =>
      ipcRenderer.invoke('log:create', batchId, action, description, operator),
  },
  export: {
    samplingsCsv: (keyword?: string) => ipcRenderer.invoke('export:samplingsCsv', keyword),
    reportsCsv: (keyword?: string) => ipcRenderer.invoke('export:reportsCsv', keyword),
    saveCsv: (defaultName: string, content: string) => ipcRenderer.invoke('dialog:saveCsv', defaultName, content),
    transferCsv: (yearMonth: string) => ipcRenderer.invoke('export:transferCsv', yearMonth),
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
    getDetail: (id: number) => Promise<any>;
    getMonthlySummary: (yearMonth?: string) => Promise<any[]>;
    getTransferList: (yearMonth: string) => Promise<any[]>;
  };
  sampling: {
    getAll: (keyword?: string) => Promise<any[]>;
    getByBatchId: (batchId: number) => Promise<any[]>;
    getPendingSend: (keyword?: string) => Promise<any[]>;
    getOverdue: () => Promise<any[]>;
    create: (data: any) => Promise<number>;
    markAsSent: (id: number, sentDate: string) => Promise<void>;
  };
  report: {
    getAll: (keyword?: string) => Promise<any[]>;
    getByBatchId: (batchId: number) => Promise<any[]>;
    create: (data: any) => Promise<number>;
  };
  disposal: {
    getAll: () => Promise<any[]>;
    getByBatchId: (batchId: number) => Promise<any[]>;
    create: (data: any) => Promise<number>;
    update: (id: number, data: any) => Promise<void>;
  };
  log: {
    getByBatchId: (batchId: number) => Promise<any[]>;
    create: (batchId: number, action: string, description?: string, operator?: string) => Promise<number>;
  };
  export: {
    samplingsCsv: (keyword?: string) => Promise<string>;
    reportsCsv: (keyword?: string) => Promise<string>;
    saveCsv: (defaultName: string, content: string) => Promise<string | null>;
    transferCsv: (yearMonth: string) => Promise<string>;
  };
  photo: {
    save: (dataUrl: string, fileName: string) => Promise<string>;
    read: (filePath: string) => Promise<string | null>;
    openDialog: () => Promise<string | null>;
  };
};
