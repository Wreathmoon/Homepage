const state = {
  msg: '',
  createdAt: null
};

exports.set = (msg = '') => {
  state.msg = msg;
  state.createdAt = Date.now();
};

exports.clear = () => {
  state.msg = '';
  state.createdAt = null;
};

exports.get = () => state; 