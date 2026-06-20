declare global {
  interface Window {
    api: {
      batch: {
        getAll: () => Promise<Batch[]>;
        getByStatus: (status: string) => Promise<Batch[]>;
        create: (data: Omit<Batch, 'id' | 'created_at' | 'status'>, operator?: string) => Promise<number>;
        delete: (id: number) => Promise<void>;
        getDetail: (id: number) => Promise<BatchDetail | null>;
        getMonthlySummary: (yearMonth?: string) => Promise<MonthlySummaryItem[]>;
        getTransferList: (yearMonth: string) => Promise<TransferDocItem[]>;
        getArchivePackage: (yearMonth: string) => Promise<ArchivePackageItem[]>;
      };
      sampling: {
        getAll: (keyword?: string) => Promise<Sampling[]>;
        getByBatchId: (batchId: number) => Promise<Sampling[]>;
        getPendingSend: (keyword?: string) => Promise<Sampling[]>;
        getOverdue: () => Promise<Sampling[]>;
        create: (data: Omit<Sampling, 'id' | 'created_at'>, operator?: string) => Promise<number>;
        markAsSent: (id: number, sentDate: string, operator?: string) => Promise<void>;
      };
      report: {
        getAll: (keyword?: string) => Promise<Report[]>;
        getByBatchId: (batchId: number) => Promise<Report[]>;
        create: (data: Omit<Report, 'id' | 'created_at'>, operator?: string) => Promise<number>;
      };
      disposal: {
        getAll: () => Promise<DisposalItem[]>;
        getByBatchId: (batchId: number) => Promise<DisposalItem[]>;
        create: (data: Omit<DisposalItem, 'id' | 'created_at'>) => Promise<number>;
        update: (id: number, data: Partial<DisposalItem>) => Promise<void>;
      };
      log: {
        getByBatchId: (batchId: number) => Promise<OperationLogItem[]>;
        create: (batchId: number, action: string, description?: string, operator?: string) => Promise<number>;
      };
      export: {
        samplingsCsv: (keyword?: string) => Promise<string>;
        reportsCsv: (keyword?: string) => Promise<string>;
        saveCsv: (defaultName: string, content: string) => Promise<string | null>;
        transferCsv: (yearMonth: string) => Promise<string>;
        archiveCsv: (yearMonth: string) => Promise<string>;
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

export type BatchStatus =
  '待取样' | '已取样待送检' | '已送检待报告' | '可用' |
  '待处置' | '禁止使用' |
  '已放行' | '已降级使用' | '已退场';

export type FinalDisposalResult = '放行' | '降级使用' | '退场' | string;

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
  testing_agency?: string;
}

export interface OperationLogItem {
  id: number;
  batch_id: number;
  action: string;
  description?: string;
  operator?: string;
  created_at: string;
}

export interface DisposalItem {
  id: number;
  batch_id: number;
  disposal_opinion: string;
  retest_plan?: string;
  retest_sample_no?: string;
  retest_testing_agency?: string;
  retest_report_no?: string;
  retest_conclusion?: string;
  retest_date?: string;
  final_result?: string;
  disposal_date: string;
  final_date?: string;
  operator?: string;
  created_at: string;
  material_type?: MaterialType;
  batch_no?: string;
  quantity?: number;
  entry_date?: string;
  status?: BatchStatus;
}

export interface TransferSamplingDetail {
  sample_no: string;
  sampling_date: string;
  has_photo: boolean;
  is_sent: boolean;
  sent_date: string;
  testing_agency: string;
}

export interface TransferReportDetail {
  report_no: string;
  report_date: string;
  conclusion: string;
  unqualified_items: string;
}

export interface TransferDisposalDetail {
  disposal_opinion: string;
  retest_plan: string;
  retest_sample_no: string;
  retest_testing_agency: string;
  retest_report_no: string;
  retest_conclusion: string;
  retest_date: string;
  final_result: string;
  final_date: string;
}

export interface TransferDocItem {
  batch_id: number;
  material_type: MaterialType;
  batch_no: string;
  quantity: number;
  furnace_no?: string;
  represent_quantity: number;
  sampling_location: string;
  entry_date: string;
  has_entry: boolean;
  has_sealing_photo: boolean;
  status: BatchStatus;
  complete: boolean;
  samplings: TransferSamplingDetail[];
  reports: TransferReportDetail[];
  disposals: TransferDisposalDetail[];
}

export interface BatchDetail {
  batch: Batch;
  samplings: Sampling[];
  reports: Report[];
  logs: OperationLogItem[];
  disposals: DisposalItem[];
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

export interface ArchiveNode {
  name: string;
  status: 'ok' | 'warn' | 'miss';
  detail?: string;
  operator?: string;
  time?: string;
}

export interface ArchiveChain {
  entry: ArchiveNode;
  samplings: ArchiveNode[];
  photos: ArchiveNode[];
  sendings: ArchiveNode[];
  originalReports: ArchiveNode[];
  retestReports: ArchiveNode[];
  disposal: ArchiveNode;
  finalResult: ArchiveNode;
}

export interface ArchivePackageItem {
  batch_id: number;
  material_type: MaterialType;
  batch_no: string;
  quantity: number;
  furnace_no?: string;
  represent_quantity: number;
  sampling_location: string;
  entry_date: string;
  status: BatchStatus;
  can_bind: boolean;
  missing_reasons: string[];
  chain: ArchiveChain;
}

export {};
