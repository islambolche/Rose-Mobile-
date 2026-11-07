export const logActivity = (type: string, detail: string) => {
  const log = {
    timestamp: new Date().toISOString(),
    type,
    detail
  };
  const logs = JSON.parse(localStorage.getItem('activity_logs') || '[]');
  logs.unshift(log);
  if (logs.length > 200) logs.pop();
  localStorage.setItem('activity_logs', JSON.stringify(logs));
};
