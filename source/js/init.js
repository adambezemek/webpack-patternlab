console.log('init');

import $ from 'jquery';

//Better jQuery = https://learn.jquery.com/code-organization/beware-anonymous-functions/
var APP = {
    onReady: function() {
        console.log('ready!');
    },
};

$(document).ready(APP.onReady);
