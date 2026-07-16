export const normalizePageRangeInput = (value: string) =>
  value.replace(/\s+/g, '').replace(/,+/g, ',').replace(/-+/g, '-').replace(/^,|,$/g, '');

// maxPage 可选：Office 文档导入时页数未知，仅校验语法与下界，上界推迟到后端已知页数时再校验。
export const expandPageRange = (value: string, maxPage?: number) => {
  const normalized = normalizePageRangeInput(value);

  if (!normalized) {
    throw new Error('页码范围不能为空');
  }

  const pages = normalized.split(',').flatMap((segment) => {
    if (segment.includes('-')) {
      const [rawStart, rawEnd] = segment.split('-');
      const start = Number(rawStart);
      const end = Number(rawEnd);

      if (start > end) {
        throw new Error('页码范围必须按升序填写');
      }

      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }

    return [Number(segment)];
  });

  if (pages.some((page) => !Number.isInteger(page) || page < 1)) {
    throw new Error('页码必须从 1 开始');
  }

  if (maxPage !== undefined && pages.some((page) => page > maxPage)) {
    throw new Error('页码超出文档总页数');
  }

  return [...new Set(pages)].sort((left, right) => left - right);
};
