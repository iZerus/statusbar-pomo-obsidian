import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import { appHasDailyNotesPluginLoaded } from 'obsidian-daily-notes-interface';
import { whiteNoiseUrl } from './audio_urls';
import PomoTimerPlugin from './main';
import { WhiteNoise } from './white_noise';

export interface PomoSettings {
	pomo: number;
	shortBreak: number;
	longBreak: number;
	longBreakInterval: number;
	autostartTimer: boolean;
	numAutoCycles: number;
	tictacVolume: number;
	missedRemindersBeforeIntensive: number;
	intensiveReminderInterval: number;
	reminderInterval: number;
	reminderIcon: boolean;
	showCycles: boolean;
	playReminderSound: boolean;
	hideTime: boolean;
	ribbonIcon: boolean;
	emoji: boolean;
	notificationSound: boolean;
	useSystemNotification: boolean;
	backgroundNoiseFile: string;
	logging: boolean;
	logFile: string;
	logText: string;
	logToDaily: boolean;
	logActiveNote: boolean;
	fancyStatusBar: boolean;
	whiteNoise: boolean;
	breakIncreasePomos: boolean;
	showMissedReminders: boolean;
	debugToConsole: boolean;
}

export const DEFAULT_SETTINGS: PomoSettings = {
	pomo: 25,
	shortBreak: 5,
	longBreak: 15,
	longBreakInterval: 4,
	autostartTimer: true,
	numAutoCycles: 0,
	tictacVolume: 50,
	missedRemindersBeforeIntensive: 3,
	intensiveReminderInterval: 15,
	reminderInterval: 3,
	reminderIcon: true,
	showCycles: false,
	playReminderSound: true,
	hideTime: false,
	ribbonIcon: true,
	emoji: true,
	notificationSound: true,
	useSystemNotification: false,
	backgroundNoiseFile: "",
	logging: false,
	logFile: "Pomodoro Log.md",
	logToDaily: false,
	logText: "[🍅] dddd, MMMM DD YYYY, h:mm A",
	logActiveNote: false,
	fancyStatusBar: false,
	whiteNoise: false,
	breakIncreasePomos: false,
	showMissedReminders: false,
	debugToConsole: false,
}


export class PomoSettingTab extends PluginSettingTab {
	plugin: PomoTimerPlugin;

	constructor(app: App, plugin: PomoTimerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Timer' });

	
		/**************  Timer settings **************/

		new Setting(containerEl)
			.setName("Pomodoro time (minutes)")
			.setDesc("Leave blank for default")
			.addText(text => text
				.setValue(this.plugin.settings.pomo.toString())
				.onChange(value => {
					this.plugin.settings.pomo = setNumericValue(value, DEFAULT_SETTINGS.pomo, this.plugin.settings.pomo);
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Short break time (minutes)")
			.setDesc("Leave blank for default")
			.addText(text => text
				.setValue(this.plugin.settings.shortBreak.toString())
				.onChange(value => {
					this.plugin.settings.shortBreak = setNumericValue(value, DEFAULT_SETTINGS.shortBreak, this.plugin.settings.shortBreak);
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Long break time (minutes)")
			.setDesc("Leave blank for default")
			.addText(text => text
				.setValue(this.plugin.settings.longBreak.toString())
				.onChange(value => {
					this.plugin.settings.longBreak = setNumericValue(value, DEFAULT_SETTINGS.longBreak, this.plugin.settings.longBreak);
					this.plugin.saveSettings();
				}));

		/*new Setting(containerEl)
			.setName("Long break interval")
			.setDesc("Number of pomos before a long break; leave blank for default")
			.addText(text => text
				.setValue(this.plugin.settings.longBreakInterval.toString())
				.onChange(value => {
					this.plugin.settings.longBreakInterval = setNumericValue(value, DEFAULT_SETTINGS.longBreakInterval, this.plugin.settings.longBreakInterval);
					this.plugin.saveSettings();
				}));*/

		if (this.plugin.settings.ribbonIcon) {
			new Setting(containerEl)
				.setName("Breaks increase pomo cycles")
				.setDesc("If true, you need to use the native button 'Start Pomodoro' in the ribbon menu and 'Ribbon icon' should be enabled")
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.breakIncreasePomos)
					.onChange(value => {
						this.plugin.settings.breakIncreasePomos = value;
						this.plugin.saveSettings();
					}));
		}

		/*new Setting(containerEl)
			.setName("Autostart timer")
			.setDesc("Start each pomodoro and break automatically. When off, click the sidebar icon on the left or use the toggle pause command to start the next timer")
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.autostartTimer)
					.onChange(value => {
						this.plugin.settings.autostartTimer = value;
						this.plugin.saveSettings();
						this.display() //force refresh
					}));*/

		/*if (this.plugin.settings.autostartTimer === false) {
			new Setting(containerEl)
				.setName("Cycles before pause")
				.setDesc("Number of pomodoro + break cycles to run automatically before stopping. Default is 0 (stops after every pomodoro and every break)")
				.addText(text => text
					.setValue(this.plugin.settings.numAutoCycles.toString())
					.onChange(value => {
						this.plugin.settings.numAutoCycles = setNumericValue(value, DEFAULT_SETTINGS.numAutoCycles, this.plugin.settings.numAutoCycles);
						this.plugin.timer.cyclesSinceLastAutoStop = 0;
						this.plugin.saveSettings();
					}));
		}*/

		containerEl.createEl('h2', { text: 'Pause reminder' });

		new Setting(containerEl)
			.setName("Pause reminder interval (minutes)")
			.setDesc("You can enable or disable the reminder of paused timer by 'Toggle pause reminder mode'. Leave blank for default")
			.addText(text => text
				.setValue(this.plugin.settings.reminderInterval.toString())
				.onChange(value => {
					this.plugin.settings.reminderInterval = setNumericValue(value, DEFAULT_SETTINGS.reminderInterval, this.plugin.settings.reminderInterval);
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Missed pause reminders before the intensive pause reminder")
			.setDesc("Leave blank for default")
			.addText(text => text
				.setValue(this.plugin.settings.missedRemindersBeforeIntensive.toString())
				.onChange(value => {
					this.plugin.settings.missedRemindersBeforeIntensive = setNumericValue(value, DEFAULT_SETTINGS.missedRemindersBeforeIntensive, this.plugin.settings.missedRemindersBeforeIntensive);
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Intensive pause reminder interval (seconds)")
			.setDesc("Leave blank for default")
			.addText(text => text
				.setValue(this.plugin.settings.intensiveReminderInterval.toString())
				.onChange(value => {
					this.plugin.settings.intensiveReminderInterval = setNumericValue(value, DEFAULT_SETTINGS.intensiveReminderInterval, this.plugin.settings.intensiveReminderInterval);
					this.plugin.saveSettings();
				}));


		/************** Appearance ************************/

		containerEl.createEl("h2", { text: "Appearance"});

		new Setting(containerEl)
			.setName("System notification")
			.setDesc("Use system notifications at the end of each pomodoro and break")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useSystemNotification)
				.onChange(value => {
					this.plugin.settings.useSystemNotification = value;
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
		.setName("Ribbon icon")
		.setDesc("Toggle left ribbon icon. Restart Obsidian for the change to take effect")
		.addToggle(toggle => toggle
				.setValue(this.plugin.settings.ribbonIcon)
				.onChange(value => {
					this.plugin.settings.ribbonIcon = value;
					this.plugin.saveSettings();
					this.display() //force refresh
				}));

		new Setting(containerEl)
		.setName("Timer emoji")
		.setDesc("Toggle 🧘/🏖️/🍅 emoji that indicate whether a timer is a pomodoro or a break.")
		.addToggle(toggle => toggle
				.setValue(this.plugin.settings.emoji)
				.onChange(value => {
					this.plugin.settings.emoji = value;
					this.plugin.saveSettings();
					this.display() //force refresh
				}));

		if (this.plugin.settings.emoji) {
			new Setting(containerEl)
				.setName("Pomodoro cycles in sidebar")
				.setDesc("Show number of pomodoro cycles in sidebar")
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.showCycles)
					.onChange(value => {
						this.plugin.settings.showCycles = value;
						this.plugin.saveSettings();
					}));
		}

		new Setting(containerEl)
			.setName("Pause reminder icon")
			.setDesc("Show the bell icon in the status bar when pause reminder mode is enabled")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.reminderIcon)
				.onChange(value => {
					this.plugin.settings.reminderIcon = value;
					this.plugin.saveSettings();
					this.display() //force refresh
				}));

		if (this.plugin.settings.reminderIcon) {
			new Setting(containerEl)
				.setName("Missed pause reminders in sidebar")
				.setDesc("Show number of missed pause reminders in sidebar. Should be enabled pause reminder icon")
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.showMissedReminders)
					.onChange(value => {
						this.plugin.settings.showMissedReminders = value;
						this.plugin.saveSettings();
					}));
		}

		new Setting(containerEl)
			.setName("Hide time")
			.setDesc("Hide the remaining time for pomodoro")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hideTime)
				.onChange(value => {
					this.plugin.settings.hideTime = value;
					this.plugin.saveSettings();
				}));


		/**************  Sound settings **************/
		containerEl.createEl("h2", { text: "Sound"});
	
		new Setting(containerEl)
			.setName("Notification sound")
			.setDesc("Play notification sound at the end of each pomodoro and break")
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.notificationSound)
					.onChange(value => {
						this.plugin.settings.notificationSound = value;
						this.plugin.saveSettings();
					}));

		new Setting(containerEl)
			.setName("Tictac")
			.setDesc("Play tictac while timer is active")
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.whiteNoise)
					.onChange(value => {
						this.plugin.settings.whiteNoise = value;
						this.plugin.saveSettings();

						if (this.plugin.settings.whiteNoise === true) {
							this.plugin.timer.whiteNoisePlayer = new WhiteNoise(this.plugin, whiteNoiseUrl);
							this.plugin.timer.whiteNoisePlayer.whiteNoise();
						} else { //if false, turn it off immediately
							this.plugin.timer.whiteNoisePlayer.stopWhiteNoise();
						}

						this.display();
					}));

		new Setting(containerEl)
			.setName("Tictac volume")
			.setDesc("Set tictac volume from 0 to 100")
			.addText(text => text
				.setValue(this.plugin.settings.tictacVolume.toString())
				.onChange(value => {
					this.plugin.settings.tictacVolume = setNumericValue(value, DEFAULT_SETTINGS.tictacVolume, this.plugin.settings.tictacVolume);
					this.plugin.settings.tictacVolume = Math.min(100, this.plugin.settings.tictacVolume);
					this.plugin.settings.tictacVolume = Math.max(0, this.plugin.settings.tictacVolume);
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Pause reminder with sound")
			.setDesc("Play a sound during a pause reminder")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.playReminderSound)
				.onChange(value => {
					this.plugin.settings.playReminderSound = value;
					this.plugin.saveSettings();
					this.display() //force refresh
				}));


		/**************  Logging settings **************/
		containerEl.createEl("h2", { text: "Debug"});
		new Setting(containerEl)
			.setName("Debug console logs")
			.setDesc("Print debug log to console devtools")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugToConsole)
				.onChange(value => {
					this.plugin.settings.debugToConsole = value;
					this.plugin.saveSettings();
					this.display() //force refresh
				}));

		/**************  Logging settings **************/
		/*containerEl.createEl("h2", { text: "Logging"});*/

		/*new Setting(containerEl)
			.setName("Logging")
			.setDesc("Enable a log of completed pomodoros")
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.logging)
					.onChange(value => {
						this.plugin.settings.logging = value;

						if (value === true) {
							this.plugin.openLogFileOnClick();
						} else {
							this.plugin.statusBar.removeClass("statusbar-pomo-logging");
						}

						this.plugin.saveSettings();
						this.display(); //force refresh
					}));*/

		//various logging settings; only show if logging is enabled (currently does not autohide, only)
		/*if (this.plugin.settings.logging === true) {

			new Setting(containerEl)
				.setName("Log file")
				.setDesc("If file doesn't already exist, it will be created")
				.addText(text => text
					.setValue(this.plugin.settings.logFile.toString())
					.onChange(value => {
						this.plugin.settings.logFile = value;
						this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName("Log to daily note")
				.setDesc("Logs to the end of today's daily note")
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.logToDaily)
					.onChange(value => {
						if (appHasDailyNotesPluginLoaded() === true) {
							this.plugin.settings.logToDaily = value;
						} else if (value === true) {
							this.plugin.settings.logToDaily = false;
							new Notice("Please enable daily notes plugin");
						}
						this.plugin.saveSettings();

					}));
	

			new Setting(containerEl)
				.setName("Timestamp Format")
				.setDesc("Specify format for the logtext using moment syntax")
				.addMomentFormat(text => text
					.setDefaultFormat(this.plugin.settings.logText)
					.setValue(this.plugin.settings.logText)
					.onChange(value => {
						this.plugin.settings.logText = value;
						this.plugin.saveSettings();
					}));

			new Setting(containerEl)
			.setName("Log active note")
			.setDesc("In log, append link pointing to the note that was active when you started the pomodoro")
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.logActiveNote)
					.onChange(value => {
						this.plugin.settings.logActiveNote = value;
						this.plugin.saveSettings();
					}));

		}*/
	}
}

//sets the setting for the given to value if it's a valid, default if empty, otherwise sends user error notice
function setNumericValue(value: string, defaultSetting: number, currentSetting: number){
	if (value === '') { //empty string -> reset to default
		return defaultSetting;
	} else if (!isNaN(Number(value)) && (Number(value) > 0)) { //if positive number, set setting
		return Number(value);
	} else { //invalid input
		new Notice("Please specify a valid number.");
		return currentSetting;
	}
}
