function ChatClient(p_user, p_channel, p_post_event) {
    "use strict";

    this.el_input = document.getElementById('chat-feed-input');
    this.el_whisper_input = document.getElementById('whisper-input');
    this.history = ['', '', '', '', '', '', '', '', '', ''];
    this.history_index = this.history.length;
    this.user = p_user;
    this.channel = p_channel;
    this.post_event = p_post_event;
    this.badge_sets = {};

    fetch('https://badges.twitch.tv/v1/badges/global/display?language=en')
        .then(response => response.json())
        .then(json => {
            if (json.badge_sets) {
                this.badge_sets = json.badge_sets;
                fetch('https://badges.twitch.tv/v1/badges/channels/' + this.channel._id + '/display?language=en')
                    .then(response => response.json())
                    .then(json => {
                        if (json.badge_sets) {
                            for (let set in json.badge_sets) {
                                this.badge_sets[set] = json.badge_sets[set];
                            }
                        }
                    });
            }
        });

    this.cs = new tmi.client({
        options: { debug: false },
        connection: {
            reconnect: true,
            secure: true
        },
        identity: {
            username: this.user.name,
            password: 'oauth:' + localStorage.token
        },
        channels: ['#' + this.channel.name]
    });

    this.cs.on('connecting', _ => this.post_to_dom('Connecting...'));
    this.cs.on('connected', _ => this.post_to_dom('Connected!'));
    this.cs.on('disconnected', reason => this.post_to_dom('Disconnected! Reason: ' + reason));

    this.cs.on('notice', (channel, msgid, message) => this.post_to_dom(message));
    this.cs.on('mods', (channel, mods) => this.post_to_dom('Mods: ' + mods.join(', ')));

    this.cs.on('whisper', (from, userstate, message, self) => {
        if (self) return;
        this.post_event('whisper', (userstate['badges-raw'] ? '[' + userstate['badges-raw'].split('/')[0] + ']' : '') + from.substring(1) + ': ' + message);
    });

    this.cs.on('roomstate', (channel, state) => {
        Object.keys(state).forEach(key => {
            let el = document.getElementById('state-' + key);
            if (el) {
                if (key === 'followers-only') {
                    if (state[key] === '-1') {
                        el.textContent = 'OFF';
                        return;
                    }
                } else if (state[key] === false) {
                    el.textContent = 'OFF';
                    return;
                }
                el.textContent = state[key];
            }
        });
    });

    this.timeout = (user, duration, reason) => {
        if (typeof reason !== "string") {
            if (app_settings.prompt_reason) {
                $('#reason-prompt').modal({ complete: _ => this.timeout(user, duration, document.getElementById('reason-prompt-input').value) }).modal('open');
            } else {
                this.timeout(user, duration, app_settings.default_reason);
            }
        } else {
            if (duration === 0) {
                this.cs.ban(this.channel.name, user, reason);
            } else {
                this.cs.timeout(this.channel.name, user, duration, reason);
            }
        }
    };

    this.get_friendly_duration = duration => {
        if (duration === 0) {
            return "ban";
        } else if (duration % 86400 === 0) {
            return (duration / 86400) + ' d';
        } else if (duration % 3600 === 0 || duration % 3600 === 1800) {
            return (duration / 3600) + ' h';
        } else if (duration % 60 === 0 || duration % 60 === 30) {
            return (duration / 60) + ' m';
        }
        return duration + ' s';
    };

    this.cs.on('message', (channel, userstate, message, self) => {
        if (channel.substring(1) !== this.channel.name) {
            return;
        }

        /* create row */

        let el_row = document.createElement('div');
        el_row.classList.add('row');
        el_row.setAttribute('data-username', userstate.username);

        /* badge images */

        let el_badges = [];
        for (let badge in userstate.badges) {
            if (this.badge_sets[badge] && this.badge_sets[badge].versions[userstate.badges[badge]]) {
                let el_badge = document.createElement('img');
                el_badge.classList.add('chat-badge', 'dynamic-tooltip');
                el_badge.alt = badge;

                let badge_data = this.badge_sets[badge].versions[userstate.badges[badge]];
                el_badge.src = badge_data[app_settings.use_high_res_emotes ? "image_url_2x" : "image_url_1x"];
                $(el_badge).tooltip({
                    delay: 50,
                    position: 'top',
                    tooltip: badge_data.description
                });
                el_badges.push(el_badge);
            }
        }

        /* actions col */

        for (let i = 0; i < app_settings.timeout_durations.length; i += 1) {
            let duration = app_settings.timeout_durations[i];
            let el_action = document.createElement('a');

            el_action.classList.add('btn-flat', 'waves-effect', 'waves-red');
            if (i > 1) {
                el_action.classList.add('hide-on-med-and-down');
            } else if (i > 0) {
                el_action.classList.add('hide-on-small-only');
            }

            el_action.addEventListener('click', evt => {
                this.timeout(userstate.username, app_settings.timeout_durations[i]);
                evt.preventDefault();
            });

            el_action.href = "#";
            el_action.textContent = this.get_friendly_duration(duration);

            el_row.appendChild(el_action);
        };

        /* username col */

        let el_username = document.createElement('span');
        el_username.classList.add('username');
        let name = userstate["display-name"] || userstate.username;
        if (name.toLowerCase() !== userstate.username) {
            name += ' (' + userstate.username + ')';
        }
        name += ': ';
        for (let i = 0; i < el_badges.length; i += 1) {
            el_username.appendChild(el_badges[i]);
        }
        el_username.appendChild(document.createTextNode(name));
        el_username.addEventListener('click', evt => {
            let modal = $('#modcard');

            // Set variables for modcard
            let modal_url = document.getElementById('modal-user');
            modal_url.textContent = name;
            modal_url.href = 'https://www.twitch.tv/' + userstate.username;

            // Event handlers
            let report = evt => {
                window.open('https://www.twitch.tv/' + userstate.username + '/report_form?description=%0a%0a' + encodeURIComponent(channel) + ' ' + userstate.username + ': ' + message);
                modal.modal('close');
                evt.preventDefault();
            }

            let timeout_helper = (evt, index) => {
                this.timeout(userstate.username, app_settings.timeout_durations[index]);
                modal.modal('close');
                evt.preventDefault();
            }

            let timeout = [
                function (evt) {
                    timeout_helper(evt, 0);
                },
                function (evt) {
                    timeout_helper(evt, 1);
                },
                function (evt) {
                    timeout_helper(evt, 2);
                },
                function (evt) {
                    timeout_helper(evt, 3);
                }
            ];

            let hotkey_handler = evt => {
                if (document.activeElement !== this.el_whisper_input) {
                    for (let i = 0; i < app_settings.modcard_hotkeys.length; i += 1) {
                        if (evt.key === app_settings.modcard_hotkeys[i]) {
                            document.getElementById('modal-timeout-' + i).click();
                            modal.modal('close');
                            evt.preventDefault();
                            return;
                        }
                    }
                    if (evt.key === app_settings.report_hotkey) {
                        document.getElementById('modal-report').click();
                        modal.modal('close');
                        evt.preventDefault();
                    }
                }
            }

            // Hook event listeners
            for (let i = 0; i < app_settings.timeout_durations.length; i += 1) {
                let timeout_button = document.getElementById('modal-timeout-' + i);
                timeout_button.addEventListener('click', timeout[i]);
                timeout_button.textContent = this.get_friendly_duration(app_settings.timeout_durations[i]);
            }
            document.getElementById('modal-report').addEventListener('click', report);

            document.addEventListener('keydown', hotkey_handler);

            let modcard_closed = _ => {
                console.log('modal closed');

                // Unregister event handlers
                for (let i = 0; i < app_settings.timeout_durations.length; i += 1) {
                    document.getElementById('modal-timeout-' + i).removeEventListener('click', timeout[i]);
                }

                document.removeEventListener('keydown', hotkey_handler);

                // Reset whisper input
                this.el_whisper_input.value = '';
            }

            // Set current user for whisper input
            this.el_whisper_input.current_user = userstate.username;

            // Open modcard
            modal.modal({
                complete: modcard_closed
            }).modal('open');
            evt.preventDefault();
        });

        el_row.appendChild(el_username);

        /* message col */

        let el_col = document.createElement('span');
        el_col.classList.add('chat-message');
        let el_coldata = this.format_emotes(message, userstate.emotes);
        el_coldata.forEach(el => {
            el_col.appendChild(el);
        });

        el_row.appendChild(el_col);

        this.post_el_to_dom(el_row);
    });

    this.timeout_messages = (channel, username, reason, duration) => {
        let el_rows = document.querySelectorAll('[data-username="' + username + '"]');
        el_rows.forEach(el => {
            el.classList.add('faded');
        });
    };
    this.cs.on('timeout', this.timeout_messages);
    this.cs.on('ban', this.timeout_messages);

    this.connect = _ => {
        this.cs.connect();
    };

    this.create_chat_text_node = text => {
        let el_span = document.createElement('span');
        el_span.classList.add('normal');
        el_span.textContent = text;
        return el_span;
    };

    this.format_emotes = (text, emotes) => {
        // Adaptation from https://github.com/tmijs/tmi.js/issues/11#issuecomment-116459845 by AlcaDesign
        let split_text = Array.from(text);
        for (let emote_id in emotes) {
            let emote_occurrences = emotes[emote_id];
            for (let occurrence_index = 0; occurrence_index < emote_occurrences.length; occurrence_index += 1) {
                let occurrence = emote_occurrences[occurrence_index].split('-');
                occurrence = [parseInt(occurrence[0], 10), parseInt(occurrence[1], 10)];
                let length = occurrence[1] - occurrence[0];
                let empty = Array.apply(null, new Array(length + 1)).map(_ => '');
                let emote_code = split_text.slice(occurrence[0], occurrence[1] + 1).join('');
                split_text = split_text.slice(0, occurrence[0]).concat(empty).concat(split_text.slice(occurrence[1] + 1, split_text.length));

                // Create image element
                let el_img = document.createElement('img');
                el_img.src = 'https://static-cdn.jtvnw.net/emoticons/v1/' + emote_id + '/' + (app_settings.use_high_res_emotes ? '2' : '1') + '.0';
                el_img.alt = 'emote';
                el_img.classList.add('chat-emote', 'dynamic-tooltip');
                $(el_img).tooltip({
                    delay: 50,
                    position: 'top',
                    tooltip: emote_code
                });

                split_text.splice(occurrence[0], 1, el_img);
            }
        }
        // Rebuild string parts to return an array of DOMElements
        let elements = [];
        let current_string = '';
        split_text.forEach(c => {
            if (typeof c === 'string') {
                current_string += c;
            } else {
                if (current_string.length > 0) {
                    elements.push(this.create_chat_text_node(current_string));
                    current_string = '';
                }
                elements.push(c);
            }
        });
        if (current_string.length > 0) {
            elements.push(this.create_chat_text_node(current_string));
        }
        return elements;
    }

    this.post_to_dom = message => {
        // For status updates

        // Create row
        let el_row = document.createElement('div');
        el_row.classList.add('row');

        let el_message = document.createElement('div');
        el_message.classList.add('col', 's12');

        let el_text = document.createElement('span');
        el_text.classList.add('flex-text');

        el_text.appendChild(document.createTextNode(message));
        el_message.appendChild(el_text);
        el_row.appendChild(el_message);

        this.post_el_to_dom(el_row);
    };

    this.post_el_to_dom = el => {
        // Add to feed
        let el_feed = document.getElementById('chat-feed');
        el_feed.appendChild(el);

        // Remove excess elements from the feed
        if (el_feed.childElementCount > 3000) {
            let el_removed = el_feed.firstChild;
            el_feed.removeChild(el_feed.firstChild);
            $(el_removed.querySelectorAll('.dynamic-tooltip')).tooltip('remove');
        }

        // Scroll to bottom if not hovering
        if (!el_feed.classList.contains("hovered")) {
            el_feed.scrollTop = el_feed.scrollHeight;
        }
    };

    this.el_whisper_input.addEventListener('keydown', evt => {
        if (evt.key === 'Enter') {
            let message = this.el_whisper_input.value.replace(/[\r\n]/g, ' ');

            // Send message on enter
            this.cs.whisper(this.el_whisper_input.current_user, message);

            this.post_to_dom('Sent: /w ' + this.el_whisper_input.current_user + ' ' + message);

            $('#modcard').modal('close');
        }
    });

    this.el_input.addEventListener('keydown', evt => {
        if (evt.key === 'Enter') {
            if (this.el_input.value.length > 500) {
                Materialize.toast('Message too long!', 500);
                return;
            }

            let message = this.el_input.value.replace(/[\r\n]/g, ' ');

            // Send message on enter
            this.cs.say(this.channel.name, message);

            /// TODO: send fancy message - remember to check drop self messages in message callback
            if (message.startsWith('.') || message.startsWith('/')) {
                this.post_to_dom('Sent: ' + message);
            }

            // Update history
            this.history.shift();
            this.history.push(this.el_input.value);
            this.history_index = this.history.length;
            this.el_input.value = '';
        } else if (evt.key === 'ArrowUp') {
            // Up arrow goes back in history
            if (this.history_index > 0) {
                this.history_index -= 1;
            }
            this.el_input.value = this.history[this.history_index];

            // Set cursor to end, setTimeout to workaround browser quirks
            setTimeout(_ => this.el_input.selectionStart = 500, 0);
        } else if (evt.key === 'ArrowDown') {
            // Down arrow goes forward in history
            if (this.history_index < this.history.length) {
                this.history_index += 1;
            }
            this.el_input.value = this.history_index === this.history.length ? '' : this.history[this.history_index];

            // Set cursor to end, setTimeout to workaround browser quirks
            setTimeout(_ => this.el_input.selectionStart = 500, 0);
        }
    });
}