import PlaceholderPage from './PlaceholderPage';

const TaskCenterPage = () => {
  return (
    <PlaceholderPage
      title="任务中心"
      description="后续接入批量任务历史、失败重试与结果追溯，本轮先提供统一落位。"
      points={['任务队列', '失败记录', '历史结果']}
    />
  );
};

export default TaskCenterPage;
