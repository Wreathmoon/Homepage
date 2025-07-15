const state = {
  status: 'normal', // normal | scheduled | maintenance
  startAt: null,    // timestamp ms
  delay: 0,
  msg: '',
  lastEndedAt: null // timestamp ms when maintenance stopped
};

exports.schedule = (delaySec = 60, msg = '服务器将在一分钟后重启并部署更新，请停止供应商录入，正在录入的请尽快保存') => {
  state.status = 'scheduled';
  state.startAt = Date.now();
  state.delay = delaySec;
  state.msg = msg;
  state.lastEndedAt = null;
  // 到期自动进入 maintenance
  setTimeout(() => {
    if (state.status === 'scheduled') state.status = 'maintenance';
  }, delaySec * 1000);
};

exports.stop = () => {
  state.status = 'normal';
  state.startAt = null;
  state.delay = 0;
  state.msg = '';
  state.lastEndedAt = Date.now();
};

exports.get = () => state; 