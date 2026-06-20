declare global {
  interface Window {
    api: {
      batch: {
        getAll: () => Promise<Batch[]>;
        getByStatus: (status: string) => Promise<Batch[]>;
        create: (data: Omit<Batch, 'id' | 'created_at' | 'status'>) => Promise<number>;
        delete: (id: number) => Promise<void>;
        getDetail: (id: number) => Promise<BatchDetail | null>;
        getMonthlySummary: (yearMonth?: string) => Promise<MonthlySummaryItem[]>;
      };
      sampling: {
        getAll: (keyword?: string) => Promise<Sampling[]>;
        getByBatchId: (batchId: number) => Promise<Sampling[]>;
        getPendingSend: () => Promise<Sampling[]>;
        getOverdue: () => Promise<Sampling[]>;
        create: (data: Omit<Sampling, 'id' | 'created_at'>) => Promise<number>;
        markAsSent: (id: number, sentDate: string) => Promise<void>;
      };
      report: {
        getAll: (keyword?: string) => Promise<Report[]>;
        getByBatchId: (batchId: number) => Promise<Report[]>;
        create: (data: Omit<Report, 'id' | 'created_at'>) => Promise<number>;
      };
      export: {
        samplingsCsv: (keyword?: string) => Promise<string>;
        reportsCsv: (keyword?: string) => Promise<string>;
        saveCsv: (defaultName: string, content: string) => Promise<string | null>;
      };
      photo: {
        save: (dataUrl: string, fileName: string) => Promise<string>;
        read: (filePath: string) => Promise<string | null>;
        openDialog: () => Promise<string | null>;
      };
    };
  }
}

export type MaterialType = '钢筋原材' | '混凝土试块' | '防水材料';

export type BatchStatus = '待取样' | '已取样待送检' | '已送检待报告' | '可用' | '待处置' | '禁止使用';

export interface Batch {
  id: number;
  material_type: MaterialType;
  batch_no: string;
  quantity: number;
  furnace_no?: string;
  represent_quantity: number;
  sampling_location: string;
  entry_date: string;
  status: BatchStatus;
  created_at: string;
}

export interface Sampling {
  id: number;
  batch_id: number;
  sample_no: string;
  witness_supervisor: string;
  sealing_photo?: string;
  sealing_photo_data?: string;
  testing_agency: string;
  sampling_date: string;
  is_sent: number;
  sent_date?: string;
  deadline_date: string;
  created_at: string;
  material_type?: MaterialType;
  batch_no?: string;
  sampling_location?: string;
}

export type ReportConclusion = '合格' | '不合格';

export interface Report {
  id: number;
  batch_id: number;
  sampling_id: number;
  report_no: string;
  conclusion: ReportConclusion;
  unqualified_items?: string;
  report_date: string;
  created_at: string;
  material_type?: MaterialType;
  batch_no?: string;
  sample_no?: string;
}

export interface BatchDetail {
  batch: Batch;
  samplings: Sampling[];
  reports: Report[];
}

export interface MonthlySummaryItem {
  month: string;
  material_type: MaterialType;
  total_count: number;
  sampled_count: number;
  sent_count: number;
  reported_count: number;
  abnormal_count: number;
}

export {};
