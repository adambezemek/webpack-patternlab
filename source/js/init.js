console.log("init");

import $ from "jquery";

var APP = {
  onReady: function() {
    console.log("ready!");
  }
};

$(document).ready(APP.onReady);
