import { Notice, moment, TFolder, TFile } from 'obsidian';
import { getDailyNote, createDailyNote, getAllDailyNotes } from 'obsidian-daily-notes-interface';
import {notificationUrl, reminderUrl, whiteNoiseUrl} from './audio_urls';
import { WhiteNoise } from './white_noise';
import { PomoSettings } from './settings';
import PomoTimerPlugin from './main';

const electron = require("electron");

const MILLISECS_IN_MINUTE = 60 * 1000;

export const enum Mode {
	Pomo,
	ShortBreak,
	LongBreak,
	NoTimer
}


export class Timer {
	plugin: PomoTimerPlugin;
	settings: PomoSettings;
	startTime: moment.Moment; /*when currently running timer started*/
	endTime: moment.Moment;   /*when currently running timer will end if not paused*/
	mode: Mode;
	pausedTime: number;  /*time left on paused timer, in milliseconds*/
	paused: boolean;
	reminderMode: boolean;
	autoPaused: boolean;
	pomosSinceStart: number;
	cyclesSinceLastAutoStop: number;
	activeNote: TFile;
	whiteNoisePlayer: WhiteNoise;
	missedReminders: number;
	reminderTicks: number;

	constructor(plugin: PomoTimerPlugin) {
		this.plugin = plugin;
		this.settings = plugin.settings;
		this.mode = Mode.NoTimer;
		this.paused = false;
		this.reminderMode = false;
		this.pomosSinceStart = 0;
		this.cyclesSinceLastAutoStop = 0;
		this.missedReminders = 0;
		this.reminderTicks = 0;

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer = new WhiteNoise(plugin, whiteNoiseUrl);
		}
	}

	onRibbonIconClick() {
		if (this.mode === Mode.NoTimer) {  //if starting from not having a timer running/paused
			this.startTimer(Mode.Pomo);
		} else { //if timer exists, pause or unpause
			this.togglePause();
		}
	}

	/*Set status bar to remaining time or empty string if no timer is running*/
	//handling switching logic here, should spin out
	async setStatusBarText(): Promise<string> {
		if (this.mode !== Mode.NoTimer) {
			let timer_type_symbol = "";
			if (this.settings.emoji === true) {
				timer_type_symbol = "🏖️ ";
				if (this.mode === Mode.Pomo) {
					timer_type_symbol = "🍅 ";
				} else if (this.mode === Mode.LongBreak) {
					timer_type_symbol = "🧘 ";
				}
			}

			let reminder_icon = '';
			if (this.settings.reminderIcon && this.reminderMode) {
				reminder_icon = ' 🔔';
			}

			let pomos_in_cycle = '';
			let pomos = 0;
			if (this.settings.showCycles) {
				if (this.settings.breakIncreasePomos && this.mode != Mode.Pomo) {
					pomos = this.pomosSinceStart % this.settings.longBreakInterval;
				} else {
					pomos = (this.pomosSinceStart + 1) % this.settings.longBreakInterval;
				}
				pomos_in_cycle += pomos == 0 ? this.settings.longBreakInterval : pomos;
			}

			let missedReminderCount = '';
			if (this.settings.reminderIcon && this.reminderMode && this.settings.showMissedReminders) {
				missedReminderCount = `${this.missedReminders}`;
			}

			if (this.paused === true) {
				if (this.settings.hideTime && this.mode == Mode.Pomo) {
					return pomos_in_cycle + timer_type_symbol + "--:--" + reminder_icon + missedReminderCount; //just show the paused time
				} else {
					return pomos_in_cycle + timer_type_symbol + millisecsToString(this.pausedTime) + reminder_icon + missedReminderCount; //just show the paused time
				}
			} else if (moment().isSameOrAfter(this.endTime)) {
				await this.handleTimerEnd();
			}

			const countDown = this.getCountdown();
			if (this.settings.hideTime && this.mode == Mode.Pomo) {
				const countDownSecs = Math.round(countDown / 1000);
				let placeholder;
				switch (countDownSecs % 2) {
					case 1:
						placeholder = "+-:+-";
						break;
					default:
						placeholder = "-+:-+";
						break;
				}
				return pomos_in_cycle + timer_type_symbol + placeholder + reminder_icon + missedReminderCount; //return display value
			} else {
				return pomos_in_cycle + timer_type_symbol + millisecsToString(countDown) + reminder_icon + missedReminderCount; //return display value
			}
		} else {
			return ""; //fixes TypeError: failed to execute 'appendChild' on 'Node https://github.com/kzhovn/statusbar-pomo-obsidian/issues/4
		}
	}
	
	logDebug(message: string, ...args: any[]) {
		if (this.settings.debugToConsole) {
			console.debug('POMODORO', message, ...args);
		}
	}

	async handleTimerEnd() {
		this.logDebug('End timer', this.mode);
		if (this.mode === Mode.Pomo) { //completed another pomo
			this.pomosSinceStart += 1;

			if (this.settings.logging === true) {
				await this.logPomo();
			}

			if (this.settings.whiteNoise === true) {
				this.whiteNoisePlayer.stopWhiteNoise();
			}
		} else if (this.mode === Mode.ShortBreak || this.mode === Mode.LongBreak) {
			this.cyclesSinceLastAutoStop += 1;
		}

		//switch mode
		if (this.settings.notificationSound === true) { //play sound end of timer
			playNotification();
		}
		if (this.settings.useSystemNotification === true) { //show system notification end of timer
			showSystemNotification(this.mode, this.settings.emoji);
		}

		if (this.settings.autostartTimer === false && this.settings.numAutoCycles <= this.cyclesSinceLastAutoStop) { //if autostart disabled, pause and allow user to start manually
			this.setupTimer();
			this.autoPaused = true;
			this.paused = true;
			this.pausedTime = this.getTotalModeMillisecs();
			this.cyclesSinceLastAutoStop = 0;
		} else {
			this.startTimer();
		}
	}

	async quitTimer(): Promise<void> {
		this.logDebug('Quit timer');
		this.mode = Mode.NoTimer;
		this.startTime = moment(0);
		this.endTime = moment(0);
		this.paused = false;
		this.pomosSinceStart = 0;

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer.stopWhiteNoise();
		}

		await this.plugin.loadSettings(); //why am I loading settings on quit? to ensure that when I restart everything is correct? seems weird
	}

	pauseTimer(): void {
		this.logDebug('Pause timer');
		this.paused = true;
		this.pausedTime = this.getCountdown();

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer.stopWhiteNoise();
		}
	}

	togglePause() {
		this.logDebug('Toggle pause timer');
		if (this.paused === true) {
			this.restartTimer();
		} else if (this.mode !== Mode.NoTimer) { //if some timer running
			this.pauseTimer();
			new Notice("Timer paused.")
		}
	}

	restartTimer(): void {
		this.logDebug('Restart timer');
		if (this.settings.logActiveNote === true && this.autoPaused === true) {
			this.setLogFile();
			this.autoPaused = false;
		}

		this.setStartAndEndTime(this.pausedTime);
		this.modeRestartingNotification();
		this.paused = false;

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer.whiteNoise();
		}
	}

	startTimer(mode: Mode = null): void {
		this.missedReminders = 0;
		this.setupTimer(mode);
		this.logDebug('Start timer', this.mode);
		this.paused = false; //do I need this?

		if (this.settings.logActiveNote === true) {
			this.setLogFile()
		}

		this.modeStartingNotification();

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer.whiteNoise();
		}
	}

	private setupTimer(mode: Mode = null) {
		if (mode === null) { //no arg -> start next mode in cycle
			if (this.mode === Mode.Pomo) {
				if (this.pomosSinceStart % this.settings.longBreakInterval === 0) {
					this.mode = Mode.LongBreak;
				} else {
					this.mode = Mode.ShortBreak;
				}
			} else { //short break, long break, or no timer
				this.mode = Mode.Pomo;
			}
		} else { //starting a specific mode passed to func
			this.mode = mode;
		}

		this.setStartAndEndTime(this.getTotalModeMillisecs());
	}

	setStartAndEndTime(millisecsLeft: number): void {
		this.startTime = moment(); //start time to current time
		this.endTime = moment().add(millisecsLeft, 'milliseconds');
	}

	/*Return milliseconds left until end of timer*/
	getCountdown(): number {
		let endTimeClone = this.endTime.clone(); //rewrite with freeze?
		return endTimeClone.diff(moment());
	}

	getTotalModeMillisecs(): number {
		switch (this.mode) {
			case Mode.Pomo: {
				return this.settings.pomo * MILLISECS_IN_MINUTE;
			}
			case Mode.ShortBreak: {
				return this.settings.shortBreak * MILLISECS_IN_MINUTE;
			}
			case Mode.LongBreak: {
				return this.settings.longBreak * MILLISECS_IN_MINUTE;
			}
			case Mode.NoTimer: {
				throw new Error("Mode NoTimer does not have an associated time value");
			}
		}
	}



	/**************  Notifications  **************/
	/*Sends notification corresponding to whatever the mode is at the moment it's called*/
	modeStartingNotification(): void {
		let time = this.getTotalModeMillisecs();
		let unit: string;

		if (time >= MILLISECS_IN_MINUTE) { /*display in minutes*/
			time = Math.floor(time / MILLISECS_IN_MINUTE);
			unit = 'minute';
		} else { /*less than a minute, display in seconds*/
			time = Math.floor(time / 1000); //convert to secs
			unit = 'second';
		}

		switch (this.mode) {
			case (Mode.Pomo): {
				new Notice(`Starting ${time} ${unit} pomodoro.`);
				break;
			}
			case (Mode.ShortBreak):
			case (Mode.LongBreak): {
				new Notice(`Starting ${time} ${unit} break.`);
				break;
			}
			case (Mode.NoTimer): {
				new Notice('Quitting pomodoro timer.');
				break;
			}
		}
	}

	modeRestartingNotification(): void {
		switch (this.mode) {
			case (Mode.Pomo): {
				new Notice(`Restarting pomodoro.`);
				break;
			}
			case (Mode.ShortBreak):
			case (Mode.LongBreak): {
				new Notice(`Restarting break.`);
				break;
			}
		}
	}



	/**************  Logging  **************/
	async logPomo(): Promise<void> {
		var logText = moment().format(this.settings.logText);
		const logFilePlaceholder = "{{logFile}}";

		if (this.settings.logActiveNote === true) {
			let linkText = this.plugin.app.fileManager.generateMarkdownLink(this.activeNote, '');
			if (logText.includes(logFilePlaceholder)) {
				logText = logText.replace(logFilePlaceholder, linkText);
			} else {
				logText = logText + " " + linkText;
			}

			logText = logText.replace(String.raw`\n`, "\n");
		}

		if (this.settings.logToDaily === true) { //use today's note
			let file = (await getDailyNoteFile()).path;
			await this.appendFile(file, logText);
		} else { //use file given in settings
			let file = this.plugin.app.vault.getAbstractFileByPath(this.settings.logFile);

			if (!file || file !instanceof TFolder) { //if no file, create
				console.log("Creating pomodoro log file");
				await this.plugin.app.vault.create(this.settings.logFile, "");
			}

			await this.appendFile(this.settings.logFile, logText);
		}
	}

	//from Note Refactor plugin by James Lynch, https://github.com/lynchjames/note-refactor-obsidian/blob/80c1a23a1352b5d22c70f1b1d915b4e0a1b2b33f/src/obsidian-file.ts#L69
	async appendFile(filePath: string, logText: string): Promise<void> {
		let existingContent = await this.plugin.app.vault.adapter.read(filePath);
		if (existingContent.length > 0) {
			existingContent = existingContent + '\r';
		}
		await this.plugin.app.vault.adapter.write(filePath, existingContent + logText);
	}

	setLogFile(){
		const activeView = this.plugin.app.workspace.getActiveFile();
		if (activeView) {
			this.activeNote = activeView;
		}
	}

	handleReminder() {
		/* Если таймер активен, то пропускаем */
		if (!this.reminderMode || (this.mode != Mode.NoTimer && !this.paused)) {
			return;
		}

		this.reminderTicks++;
		this.logDebug('Reminder tick', this.reminderTicks);

		if (this.missedReminders < this.settings.missedRemindersBeforeIntensive) {
			if (this.reminderTicks < (this.settings.reminderInterval * 60)) {
				return;
			}
		} else {
			if (this.reminderTicks < this.settings.intensiveReminderInterval) {
				return;
			}
		}
		this.reminderTicks = 0;

		this.missedReminders++;
		this.logDebug('Send reminder', this.missedReminders);
		if (this.settings.useSystemNotification) {
			showSystemNotification(Mode.NoTimer, this.settings.emoji);
		}
		if (this.settings.playReminderSound) {
			playReminder();
		}
		new Notice('You forgot to turn on the timer');
	}
}

/*Returns [HH:]mm:ss left on the current timer*/
function millisecsToString(millisecs: number): string {
	let formattedCountDown: string;

	if (millisecs >= 60 * 60 * 1000) { /* >= 1 hour*/
		formattedCountDown = moment.utc(millisecs).format('HH:mm:ss');
	} else {
		formattedCountDown = moment.utc(millisecs).format('mm:ss');
	}

	return formattedCountDown.toString();
}

function playNotification(): void {
	const audio = new Audio(notificationUrl);
	audio.play();
}

function playReminder(): void {
	const audio = new Audio(reminderUrl);
	audio.play();
}

function showSystemNotification(mode:Mode, useEmoji:boolean): void {
	let text = "";
	switch (mode) {
		case (Mode.Pomo): {
			let emoji = useEmoji ? "🏖" : ""
			text = `Time to take a break ${emoji}`;
			break;
		}
		case (Mode.ShortBreak):
		case (Mode.LongBreak): {
			let emoji = useEmoji ? "🍅" : ""
			text = `Time for the next pomodoro ${emoji}`;
			break;
		}
		case (Mode.NoTimer): {
			let emoji = useEmoji ? "🔔" : ""
			text = `You forgot to turn on the timer ${emoji}`;
			break;
		}
	}
	// let emoji = useEmoji ? "🍅" : ""
	// let title = `Obsidian Pomodoro ${emoji}`;
	let title = `Obsidian Pomodoro`;

	// Show system notification
	const Notification = (electron as any).remote.Notification;
	const n = new Notification({
		title: title,
		body: text,
		silent: true
	});
	n.on("click", () => {
		n.close();
	});
	n.show();
}

export async function getDailyNoteFile(): Promise<any> { // Должен быть Promise<TFile>, но почему-то не компилится
	const file = getDailyNote(moment() as any, getAllDailyNotes()); // as any, because getDailyNote is importing its own Moment and I'm using Obsidian's

	if (!file) {
		return await createDailyNote(moment() as any);
	}

	return file;
}






