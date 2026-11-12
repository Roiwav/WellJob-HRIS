export function highlightNotificationElement(element) {
  if (!element) return () => {};
  element.classList.add("notification-focus");
  const frame = requestAnimationFrame(() => element.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "nearest" }));
  const timer = setTimeout(() => element.classList.remove("notification-focus"), 5000);
  return () => { cancelAnimationFrame(frame); clearTimeout(timer); element.classList.remove("notification-focus"); };
}

// Wait for the authorized record/modal to render, including lazy loaded pages.
export function focusNotificationTarget(selector, root = document) {
  let stopHighlight = () => {};
  let observer;
  let timeout;
  const find = () => {
    const element = root.querySelector(selector);
    if (!element) return false;
    observer?.disconnect();
    clearTimeout(timeout);
    stopHighlight = highlightNotificationElement(element);
    return true;
  };
  if (!find()) {
    observer = new MutationObserver(find);
    observer.observe(root.body || root, { childList: true, subtree: true });
    timeout = setTimeout(() => observer.disconnect(), 10000);
  }
  return () => { observer?.disconnect(); clearTimeout(timeout); stopHighlight(); };
}
