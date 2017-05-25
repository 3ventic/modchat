var app_settings = {
    version: 5,
    hover_notification: true,
    use_high_res_emotes: false,
    timeout_durations: [0, 3600, 600, 1],
    modcard_hotkeys: ['b', 'h', 't', 'p'], // One for each timeout duration in order
    name_colors: false,
    prompt_reason: false,
    default_reason: ''
};

(function () {
    "use strict";

    // Defaults for necessary settings
    var default_settings = {
        modcard_hotkeys: ['b', 'h', 't', 'p']
    };

    // Load settings
    var settings = JSON.parse(localStorage.getItem('settings'));
    if (settings) {
        if (settings.version === app_settings.version) {
            app_settings = settings;
            Materialize.toast('Loaded settings', 2500);
        } else {
            /// TODO: upgrade process: apply relevant settings on top of default app_settings
            Materialize.toast('Settings level upgraded. Settings reset to avoid conflicts.', 10000);
            localStorage.removeItem('settings');
        }
    }

    // Set inputs
    document.getElementById('hover-notification').checked = app_settings.hover_notification;
    document.getElementById('highres-emotes').checked = app_settings.use_high_res_emotes;
    document.getElementById('name-colors').checked = app_settings.name_colors;
    document.getElementById('prompt-reason').checked = app_settings.prompt_reason;
    document.getElementById('default-reason').value = app_settings.default_reason;

    for (let i = 0; i < app_settings.timeout_durations.length; i += 1) {
        let input = document.getElementById('timeout-setting-' + i);
        input.value = app_settings.timeout_durations[i];
        input.addEventListener('change', function () {
            app_settings.timeout_durations[i] = parseInt(this.value, 10);
        });

        input = document.getElementById('timeout-hotkey-' + i);
        input.value = app_settings.modcard_hotkeys[i];
        input.addEventListener('change', function () {
            app_settings.modcard_hotkeys[i] = this.value = this.value ? this.value[0] : default_settings.modcard_hotkeys[i];
        });
    }

    // Listen for changes
    document.getElementById('hover-notification').addEventListener('change', function () {
        app_settings.hover_notification = this.checked;
    });
    document.getElementById('highres-emotes').addEventListener('change', function () {
        app_settings.use_high_res_emotes = this.checked;
    });
    document.getElementById('name-colors').addEventListener('change', function () {
        app_settings.name_colors = this.checked;
    });
    document.getElementById('prompt-reason').addEventListener('change', function () {
        app_settings.prompt_reason = this.checked;
    });
    document.getElementById('default-reason').addEventListener('change', function () {
        app_settings.default_reason = this.value;
    });
    document.getElementById('save-settings').addEventListener('click', function () {
        localStorage.setItem('settings', JSON.stringify(app_settings));
        Materialize.toast('Settings saved! Please note some settings require a refresh to take effect.', 5000);
    });
})();