console.log('init');

import $ from 'jquery';

var APP = {
  onReady: function() {
    console.log('ready! Woot!');
  },
};

$(document).ready(APP.onReady);
