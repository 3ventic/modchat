function PubSub() {
    "use strict";

    this.color = {
        SYSTEM: 'pink',
        automod: 'yellow',
        mod: 'deep-orange',
        whisper: 'blue-grey'
    };
    this.dedupe = [null, null, null, null];
    this.ws = null;

    this.connect = _ => {
        let heartbeatInterval = 1000 * 60;
        let reconnectInterval = 1000 * 3;
        let heartbeatHandle;

        this.ws = new WebSocket('wss://pubsub-edge.twitch.tv');

        this.ws.onopen = event => {
            this.post_event_to_dom('SYSTEM', 'PubSub Connected');
            this.heartbeat();
            heartbeatHandle = setInterval(this.heartbeat, heartbeatInterval);
        };

        this.ws.onerror = event => {
            this.post_event_to_dom('SYSTEM', 'PubSub Error: ' + JSON.stringify(event));
        };

        this.ws.onmessage = event => {
            let json = JSON.parse(event.data);
            if (json.type === 'MESSAGE') {
                let data = JSON.parse(json.data.message);
                if (data.data.moderation_action === 'automod_rejected') {
                    this.post_automodevent_to_dom(data.data);
                } else if (data.data.moderation_action === 'denied_automod_message' || data.data.moderation_action === 'approved_automod_message') {
                    this.post_automod_action_taken_to_dom(data.data);
                } else if (data.data.moderation_action) {
                    let mod = data.data.created_by;
                    this.post_event_to_dom('mod', mod + ': /' + data.data.moderation_action + ' ' + data.data.args.join(' '));
                } else {
                    /// TODO: handle other events
                    console.log(json, data);
                }
            } else if (json.type === 'RECONNECT') {
                this.ws.close();
            }
        };

        this.ws.onclose = _ => {
            clearInterval(heartbeatHandle);
            this.post_event_to_dom('SYSTEM', 'PubSub Reconnecting...');
            setTimeout(this.connect, reconnectInterval);
        };
    }

    this.listen = topic => {
        let to_listen = Array.isArray(topic) ? topic : [topic];
        let message = {
            type: 'LISTEN',
            nonce: nonce(15),
            data: {
                topics: to_listen,
                auth_token: localStorage.token
            }
        };
        this.send_json(message);
    };

    this.heartbeat = _ => {
        let message = {
            type: 'PING'
        };
        this.send_json(message);
    };

    this.send_json = message => {
        this.ws.send(JSON.stringify(message));
    };

    this.post_event_to_dom = (type, message) => {
        // Drop duplicates
        let dupekey = type + '!' + message;
        if (this.dedupe.indexOf(dupekey) > -1) {
            return;
        }
        this.dedupe.shift();
        this.dedupe.push(dupekey);

        // Create row
        let el_row = document.createElement('div');
        el_row.classList.add('row');

        // Create first column
        let el_col = document.createElement('div');
        el_col.classList.add('col', 's2', 'm1');

        // Create first column data
        let el_type = document.createElement('span');
        el_type.classList.add(this.color[type] || "black");
        el_type.classList.add('darken-3', 'badge', 'new');
        el_type.setAttribute('data-badge-caption', '');

        // Add children to parents
        el_type.appendChild(document.createTextNode(type));
        el_col.appendChild(el_type);
        el_row.appendChild(el_col);

        // Create second column
        el_col = document.createElement('div');
        el_col.classList.add('col', 's10', 'm11');

        // Create second column data
        let el_message = document.createElement('span');

        // Add children to parents
        el_message.appendChild(document.createTextNode(message));
        el_col.appendChild(el_message);
        el_row.appendChild(el_col);

        // Add to feed
        let el_feed = document.getElementById('events');
        el_feed.appendChild(el_row);
        
        // Remove excess elements from the feed
        if (el_feed.childElementCount > 100) {
            el_feed.removeChild(el_feed.firstChild);
        }

        // Scroll to bottom if not hovering
        if (!el_feed.classList.contains("hovered")) {
            el_feed.scrollTop = el_feed.scrollHeight;
        }
    }

    this.post_automodevent_to_dom = data => {
        // args ["username", "1st_word_in_message", "2nd_word_in_message", ...]
        // args[0] to user, join rest to rebuild message
        let user = data.args.shift();
        let message = data.args.join(' ');
        this.post_event_to_dom('automod', user + ': ' + message);
    };

    this.post_automod_action_taken_to_dom = data => {
        this.post_event_to_dom('mod', data.created_by + ' ' + data.moderation_action.split('_')[0] + ' held message from ' + data.args[0]);
    }
}

// Source: https://www.thepolyglotdeveloper.com/2015/03/create-a-random-nonce-string-using-javascript/
function nonce(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}