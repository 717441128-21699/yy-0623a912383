export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBatch(data: {
  material_type: string;
  batch_no: string;
  quantity: number;
  furnace_no?: string;
  represent_quantity: number;
  sampling_location: string;
  entry_date: string;
}): ValidationResult {
  const errors: string[] = [];

  if (!data.material_type || !['钢筋原材', '混凝土试块', '防水材料'].includes(data.material_type)) {
    errors.push('材料类型无效');
  }

  if (!data.batch_no || data.batch_no.trim().length === 0) {
    errors.push('批次编号不能为空');
  }

  if (!data.entry_date || data.entry_date.trim().length === 0) {
    errors.push('进场日期不能为空');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.entry_date)) {
    errors.push('进场日期格式无效，应为 YYYY-MM-DD');
  }

  if (typeof data.quantity !== 'number' || isNaN(data.quantity) || data.quantity <= 0) {
    errors.push('进场数量必须大于 0');
  }

  if (typeof data.represent_quantity !== 'number' || isNaN(data.represent_quantity) || data.represent_quantity <= 0) {
    errors.push('代表数量必须大于 0');
  }

  if (data.material_type === '钢筋原材' && (!data.furnace_no || data.furnace_no.trim().length === 0)) {
    errors.push('钢筋原材的炉批号不能为空');
  }

  if (!data.sampling_location || data.sampling_location.trim().length === 0) {
    errors.push('取样部位不能为空');
  }

  return { valid: errors.length === 0, errors };
}

export function validateSampling(data: {
  batch_id: number;
  sample_no: string;
  witness_supervisor: string;
  testing_agency: string;
  sampling_date: string;
  deadline_date: string;
}): ValidationResult {
  const errors: string[] = [];

  if (!data.batch_id || data.batch_id <= 0) {
    errors.push('请选择进场批次');
  }

  if (!data.sample_no || data.sample_no.trim().length === 0) {
    errors.push('样品编号不能为空');
  }

  if (!data.witness_supervisor || data.witness_supervisor.trim().length === 0) {
    errors.push('见证监理不能为空');
  }

  if (!data.testing_agency || data.testing_agency.trim().length === 0) {
    errors.push('检测机构不能为空');
  }

  if (!data.sampling_date || data.sampling_date.trim().length === 0) {
    errors.push('取样日期不能为空');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.sampling_date)) {
    errors.push('取样日期格式无效，应为 YYYY-MM-DD');
  }

  if (!data.deadline_date || data.deadline_date.trim().length === 0) {
    errors.push('送检时限不能为空');
  }

  return { valid: errors.length === 0, errors };
}

export function validateReport(data: {
  batch_id: number;
  sampling_id: number;
  report_no: string;
  conclusion: string;
  report_date: string;
}): ValidationResult {
  const errors: string[] = [];

  if (!data.sampling_id || data.sampling_id <= 0) {
    errors.push('请选择送检记录');
  }

  if (!data.batch_id || data.batch_id <= 0) {
    errors.push('批次ID无效');
  }

  if (!data.report_no || data.report_no.trim().length === 0) {
    errors.push('报告编号不能为空');
  }

  if (!data.conclusion || !['合格', '不合格'].includes(data.conclusion)) {
    errors.push('检测结论无效');
  }

  if (!data.report_date || data.report_date.trim().length === 0) {
    errors.push('报告日期不能为空');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.report_date)) {
    errors.push('报告日期格式无效，应为 YYYY-MM-DD');
  }

  return { valid: errors.length === 0, errors };
}
