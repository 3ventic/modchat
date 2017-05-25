var twitchApiBaseUrl = 'https://api.twitch.tv/v5/';
var twitchApiBaseHeaders = new Headers({
    'Client-Id': 'ises2vcn10gk4dq0w083d0ortqwdzx',
    'Accept': 'application/json',
    'Authorization': 'OAuth ' + localStorage.token
});

(function () {
    'use strict';

    var channel = {};
    var user = {};
    var pubsub = new PubSub();

    function initialize() {
        // Initialize app

        if (window.location.hash.length > 1) {
            load_channel_data(window.location.hash.substring(1));
        } else {
            $('#channel-prompt').modal({
                dismissible: false,
                complete: function () {
                    window.location.hash = document.getElementById('channel-prompt-input').value;
                    window.location.reload();
                }
            }).modal('open');
        }
    }

    function load_channel_data(channel_name) {
        console.log('Loading app for channel ' + channel_name);
        fetch(twitchApiBaseUrl, { headers: twitchApiBaseHeaders })
            .then(response => response.json())
            .then(function (json) {
                if (!json.token.valid) {
                    window.location.replace("./auth.html");
                    return;
                }
                pubsub.connect();
                fetch(twitchApiBaseUrl + 'users/' + json.token.user_id, { headers: twitchApiBaseHeaders })
                    .then(response => response.json())
                    .then(function (json) {
                        user = json;
                        fetch(twitchApiBaseUrl + 'users/?login=' + encodeURIComponent(channel_name), { headers: twitchApiBaseHeaders })
                            .then(response => response.json())
                            .then(function (json) {
                                if (json.users.length === 0) {
                                    // Invalid channel name, ask again
                                    window.location.hash = '';
                                    initialize();
                                } else {
                                    fetch(twitchApiBaseUrl + 'channels/' + json.users[0]._id, { headers: twitchApiBaseHeaders })
                                        .then(response => response.json())
                                        .then(function (json) {
                                            channel = json;
                                            load_app();
                                        });
                                }
                            });
                    });
            });
    }

    function load_app() {
        pubsub.listen('chat_moderator_actions.' + user._id + '.' + channel._id);
        var tmiclient = new ChatClient(user, channel, pubsub.post_event_to_dom);
        tmiclient.connect();
    }

    // Event handlers
    let feeds = document.getElementsByClassName('feed');
    for (let i = 0; i < feeds.length; i += 1) {
        feeds[i].addEventListener('mouseenter', function () {
            this.classList.add('hovered');
            if (app_settings.hover_notification) {
                Materialize.toast('Feed paused due to hover', 1500);
            }
        });
        feeds[i].addEventListener('mouseleave', function () {
            this.classList.remove('hovered');
        });
    }

    let noops = document.getElementsByClassName('no-op');
    for (let i = 0; i < noops.length; i += 1) {
        noops[i].addEventListener('click', function (evt) {
            evt.preventDefault();
        });
    }

    // Materialize initializations
    $('.tooltipped').tooltip({ delay: 50 });

    initialize();
})();