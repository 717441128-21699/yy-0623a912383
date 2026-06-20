import type { MaterialType } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBatchForm(data: {
  material_type: MaterialType;
  batch_no: string;
  quantity: string;
  furnace_no: string;
  represent_quantity: string;
  sampling_location: string;
  entry_date: string;
}): ValidationResult {
  const errors: string[] = [];

  if (!data.batch_no.trim()) {
    errors.push('批次编号不能为空');
  }

  if (!data.entry_date.trim()) {
    errors.push('进场日期不能为空');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.entry_date)) {
    errors.push('进场日期格式无效');
  }

  const qty = parseFloat(data.quantity);
  if (isNaN(qty) || qty <= 0) {
    errors.push('进场数量必须大于 0');
  }

  const repQty = parseFloat(data.represent_quantity);
  if (isNaN(repQty) || repQty <= 0) {
    errors.push('代表数量必须大于 0');
  }

  if (data.material_type === '钢筋原材' && !data.furnace_no.trim()) {
    errors.push('钢筋原材的炉批号不能为空');
  }

  if (!data.sampling_location.trim()) {
    errors.push('取样部位不能为空');
  }

  return { valid: errors.length === 0, errors };
}

export function validateSamplingForm(data: {
  batch_id: string;
  sample_no: string;
  witness_supervisor: string;
  testing_agency: string;
  sampling_date: string;
}): ValidationResult {
  const errors: string[] = [];

  if (!data.batch_id) {
    errors.push('请选择进场批次');
  }

  if (!data.sample_no.trim()) {
    errors.push('样品编号不能为空');
  }

  if (!data.witness_supervisor.trim()) {
    errors.push('见证监理不能为空');
  }

  if (!data.testing_agency.trim()) {
    errors.push('检测机构不能为空');
  }

  if (!data.sampling_date.trim()) {
    errors.push('取样日期不能为空');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.sampling_date)) {
    errors.push('取样日期格式无效');
  }

  return { valid: errors.length === 0, errors };
}

export function validateReportForm(data: {
  sampling_id: string;
  report_no: string;
  report_date: string;
}): ValidationResult {
  const errors: string[] = [];

  if (!data.sampling_id) {
    errors.push('请选择送检记录');
  }

  if (!data.report_no.trim()) {
    errors.push('报告编号不能为空');
  }

  if (!data.report_date.trim()) {
    errors.push('报告日期不能为空');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.report_date)) {
    errors.push('报告日期格式无效');
  }

  return { valid: errors.length === 0, errors };
}
