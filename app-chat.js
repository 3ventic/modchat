function ChatClient(user, channel, post_event) {
    "use strict";

    this.el_input = document.getElementById('chat-feed-input');
    this.history = ['', '', '', '', '', '', '', '', '', ''];
    this.history_index = this.history.length;
    this.user = user;
    this.channel = channel;
    this.post_event = post_event;

    /// TODO: load badges

    this.cs = new tmi.client({
        options: { debug: false },
        connection: {
            reconnect: true,
            secure: true
        },
        identity: {
            username: user.name,
            password: 'oauth:' + localStorage.token
        },
        channels: ['#' + channel.name]
    });

    this.cs.on('connecting', _ => this.post_to_dom('Connecting...'));
    this.cs.on('connected', _ => this.post_to_dom('Connected!'));
    this.cs.on('disconnected', reason => this.post_to_dom('Disconnected! Reason: ' + reason));

    this.cs.on('notice', (channel, msgid, message) => this.post_to_dom(message));
    this.cs.on('mods', (channel, mods) => this.post_to_dom('Mods: ' + mods.join(', ')));

    this.cs.on('whisper', (from, userstate, message, self) => {
        if (self) return;
        this.post_event('whisper', (userstate['badges-raw'] ? '[' + userstate['badges-raw'].split('/')[0] + ']' : '') + from + ': ' + message);
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

    this.cs.on('message', (channel, userstate, message, self) => {
        let el_row = document.createElement('div');
        el_row.classList.add('row');
        el_row.setAttribute('data-username', userstate.username);

        /* actions col */

        let el_col = document.createElement('div');
        el_col.classList.add('col', 's3', 'xl2', 'actions');

        for (let i = 0; i < app_settings.timeout_durations.length; i += 1) {
            let duration = app_settings.timeout_durations[i];
            let el_action = document.createElement('a');

            el_action.classList.add('btn-flat', 'waves-effect', 'waves-red')
            if (i > 1) {
                el_action.classList.add('hide-on-med-and-down');
            } else if (i > 0) {
                el_action.classList.add('hide-on-small-only');
            }

            el_action.addEventListener('click', evt => {
                /// TODO: prompt for reason or send timeout
                evt.preventDefault();
            });

            el_action.href = "#";
            el_action.textContent = this.get_friendly_duration(duration);

            el_col.appendChild(el_action);
        };

        el_row.appendChild(el_col);

        /* badge col */

        el_col = document.createElement('div');
        el_col.classList.add('col', 'hide-on-med-and-down', 'l2', 'xl1');

        /* username col */

        el_col = document.createElement('div');
        el_col.classList.add('col', 's4', 'm3', 'l2', 'right-align');

        let el_coldata = document.createElement('span');
        el_coldata.classList.add('username');
        let name = userstate["display-name"] || userstate.username;
        if (name.toLowerCase() !== userstate.username) {
            name += ' (' + userstate.username + ')';
        }
        el_coldata.textContent = name;
        el_coldata.addEventListener('click', evt => {
            /// TODO: open mod card
            evt.preventDefault();
        });

        el_col.appendChild(el_coldata);
        el_row.appendChild(el_col);

        /* message col */

        el_col = document.createElement('div');
        el_col.classList.add('col', 's5', 'm6', 'l7', 'xl8', 'chat-message');
        el_coldata = this.format_emotes(message, userstate.emotes);
        el_coldata.forEach(el => {
            el_col.appendChild(el);
        });

        el_row.appendChild(el_col);

        this.post_el_to_dom(el_row);
    });

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

    this.timeout_messages = (channel, username, reason, duration) => {
        let el_rows = document.querySelectorAll('[data-username="' + username + '"]');
        console.log(el_rows);
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
                split_text = split_text.slice(0, occurrence[0]).concat(empty).concat(split_text.slice(occurrence[1] + 1, split_text.length));

                // Create image element
                let el_img = document.createElement('img');
                el_img.src = 'https://static-cdn.jtvnw.net/emoticons/v1/' + emote_id + '/' + (app_settings.use_high_res_emotes ? '2' : '1') + '.0';
                el_img.alt = 'emote';
                el_img.classList.add('chat-emote');

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
        if (el_feed.childElementCount > 100) {
            el_feed.removeChild(el_feed.firstChild);
        }

        // Scroll to bottom if not hovering
        if (!el_feed.classList.contains("hovered")) {
            el_feed.scrollTop = el_feed.scrollHeight;
        }
    };

    this.el_input.addEventListener('keydown', evt => {
        if (evt.key === 'Enter') {
            if (this.el_input.value.length > 500) {
                Materialize.toast('Message too long!', 500);
                return;
            }

            let message = this.el_input.value.replace(/[\r\n]/g, ' ');

            // Send message on enter
            this.cs.say(channel.name, message);

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