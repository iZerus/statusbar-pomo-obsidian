import { Notice, Plugin } from 'obsidian';
import { PomoSettingTab, PomoSettings, DEFAULT_SETTINGS } from './settings';
import { getDailyNoteFile, Mode, Timer } from './timer';


export default class PomoTimerPlugin extends Plugin {
	settings: PomoSettings;
	statusBar: HTMLElement;
	timer: Timer;
	worker: Worker;

	async onload() {
		console.log('Loading status bar pomodoro timer');

		await this.loadSettings();
		this.addSettingTab(new PomoSettingTab(this.app, this));

		this.statusBar = this.addStatusBarItem();
		this.statusBar.addClass("statusbar-pomo");
		if (this.settings.logging === true) {
			this.openLogFileOnClick();
		}

		this.timer = new Timer(this);

		/*Adds icon to the left side bar which starts the pomo timer when clicked
		  if no timer is currently running, and otherwise quits current timer*/
		if (this.settings.ribbonIcon === true) {
			this.addRibbonIcon('clock', 'Start pomodoro', async () => {
				this.timer.onRibbonIconClick();
			});
		}

		const workerCode = `
			setInterval(() => {
				self.postMessage({ type: 'reminder' });
			}, 1000);
			setInterval(() => {
				self.postMessage({ type: 'pomodoro' });
			}, 500);
		`;
		const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
		this.worker = new Worker(URL.createObjectURL(workerBlob));
		this.worker.onmessage = async (event: MessageEvent) => {
			switch (event.data.type) {
				case 'pomodoro':
					this.statusBar.setText(await this.timer.setStatusBarText())
					break;
				case 'reminder':
					this.timer.handleReminder()
					break;
			}
		};

		this.addCommand({
			id: 'start-satusbar-pomo',
			name: 'Start pomodoro',
			icon: 'play',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						this.timer.startTimer(Mode.Pomo);
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'start-short-break-satusbar-pomo',
			name: 'Start short break pomodoro',
			icon: 'play',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						if (this.settings.breakIncreasePomos) {
							this.timer.pomosSinceStart++;
						}
						this.timer.startTimer(Mode.ShortBreak);
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'start-long-break-satusbar-pomo',
			name: 'Start long break pomodoro',
			icon: 'play',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						if (this.settings.breakIncreasePomos) {
							this.timer.pomosSinceStart++;
						}
						this.timer.startTimer(Mode.LongBreak);
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'toggle-reminder-satusbar-pomo',
			name: 'Toggle pause reminder mode',
			icon: 'play',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						this.timer.reminderMode = !this.timer.reminderMode;
						new Notice(`Pause reminder mode is ${this.timer.reminderMode ? 'on' : 'off'}`);
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'pause-satusbar-pomo',
			name: 'Toggle timer pause',
			icon: 'pause',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf && this.timer.mode !== Mode.NoTimer) {
					if (!checking) {
						this.timer.togglePause();
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'quit-satusbar-pomo',
			name: 'Quit timer',
			icon: 'quit',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf && this.timer.mode !== Mode.NoTimer) {
					if (!checking) {
						this.timer.quitTimer();
					}
					return true;
				}
				return false;
			}
		});
	}


	//on click, open log file; from Day Planner https://github.com/lynchjames/obsidian-day-planner/blob/c8d4d33af294bde4586a943463e8042c0f6a3a2d/src/status-bar.ts#L53
	openLogFileOnClick() {
		this.statusBar.addClass("statusbar-pomo-logging");

		this.statusBar.onClickEvent(async (ev: any) => {
			if (this.settings.logging === true) { //this is hacky, ideally I'd just unwatch the onClickEvent as soon as I turned logging off
				try {
					var file: string;
					if (this.settings.logToDaily === true) {
						file = (await getDailyNoteFile()).path;
					} else {
						file = this.settings.logFile;
					}

					this.app.workspace.openLinkText(file, '', false);
				} catch (error) {
					console.log(error);
				}
			}
		});
	}

	onunload() {
		this.timer.quitTimer();
		this.worker.terminate();
		console.log('Unloading status bar pomodoro timer');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}