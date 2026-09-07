/**
 * Tạo một hàm debounced bao bọc hàm callback.
 * Chỉ thực thi hàm sau khi đã trôi qua khoảng thời gian `waitMs` kể từ lần gọi gần nhất.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  waitMs = 400,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  };

  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}
