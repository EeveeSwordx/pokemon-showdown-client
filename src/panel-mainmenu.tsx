/**
 * Main menu panel
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license AGPLv3
 */

type RoomInfo = {title: string, desc?: string, userCount?: number, subRooms?: string[]};

class MainMenuRoom extends PSRoom {
	readonly classType: string = 'mainmenu';
	userdetailsCache: {[userid: string]: {
		userid: ID,
		avatar?: string | number,
		group?: string,
		rooms?: {[roomid: string]: {isPrivate?: true, p1?: string, p2?: string}},
	}} = {};
	roomsCache: {
		battleCount?: number,
		userCount?: number,
		chat?: RoomInfo[],
		official?: RoomInfo[],
		pspl?: RoomInfo[],
	} = {};
	receive(line: string) {
		const tokens = PS.lineParse(line);
		switch (tokens[0]) {
		case 'challstr':
			PSLoginServer.query({
				act: 'upkeep',
				challstr: tokens[1],
			}, res => {
				if (!res) return;
				if (!res.loggedin) return;
				this.send(`/trn ${res.username},0,${res.assertion}`);
			});
			return;
		case 'updateuser':
			PS.user.setName(tokens[1], tokens[2] === '1', tokens[3]);
			return;
		case 'queryresponse':
			this.handleQueryResponse(tokens[1] as ID, JSON.parse(tokens[2]));
			return;
		case 'pm':
			this.handlePM(tokens[1], tokens[2], tokens[3]);
			return;
		case 'formats':
			this.parseFormats(tokens);
			return;
		}
		const lobby = PS.rooms['lobby'];
		if (lobby) lobby.receive(line);
	}
	parseFormats(formatsList: string[]) {
		let isSection = false;
		let section = '';

		let column = 0;

		window.BattleFormats = {};
		for (let j = 1; j < formatsList.length; j++) {
			const entry = formatsList[j];
			if (isSection) {
				section = entry;
				isSection = false;
			} else if (entry === ',LL') {
				PS.teams.usesLocalLadder = true;
			} else if (entry === '' || (entry.charAt(0) === ',' && !isNaN(Number(entry.slice(1))))) {
				isSection = true;

				if (entry) {
					column = parseInt(entry.slice(1), 10) || 0;
				}
			} else {
				let name = entry;
				let searchShow = true;
				let challengeShow = true;
				let tournamentShow = true;
				let team: 'preset' | null = null;
				let teambuilderLevel: number | null = null;
				let lastCommaIndex = name.lastIndexOf(',');
				let code = lastCommaIndex >= 0 ? parseInt(name.substr(lastCommaIndex + 1), 16) : NaN;
				if (!isNaN(code)) {
					name = name.substr(0, lastCommaIndex);
					if (code & 1) team = 'preset';
					if (!(code & 2)) searchShow = false;
					if (!(code & 4)) challengeShow = false;
					if (!(code & 8)) tournamentShow = false;
					if (code & 16) teambuilderLevel = 50;
				} else {
					// Backwards compatibility: late 0.9.0 -> 0.10.0
					if (name.substr(name.length - 2) === ',#') { // preset teams
						team = 'preset';
						name = name.substr(0, name.length - 2);
					}
					if (name.substr(name.length - 2) === ',,') { // search-only
						challengeShow = false;
						name = name.substr(0, name.length - 2);
					} else if (name.substr(name.length - 1) === ',') { // challenge-only
						searchShow = false;
						name = name.substr(0, name.length - 1);
					}
				}
				let id = toID(name);
				let isTeambuilderFormat = !team && name.slice(-11) !== 'Custom Game';
				let teambuilderFormat = '' as ID;
				let teambuilderFormatName = '';
				if (isTeambuilderFormat) {
					teambuilderFormatName = name;
					if (id.slice(0, 3) !== 'gen') {
						teambuilderFormatName = '[Gen 6] ' + name;
					}
					let parenPos = teambuilderFormatName.indexOf('(');
					if (parenPos > 0 && name.slice(-1) === ')') {
						// variation of existing tier
						teambuilderFormatName = teambuilderFormatName.slice(0, parenPos).trim();
					}
					if (teambuilderFormatName !== name) {
						teambuilderFormat = toID(teambuilderFormatName);
						if (BattleFormats[teambuilderFormat]) {
							BattleFormats[teambuilderFormat].isTeambuilderFormat = true;
						} else {
							BattleFormats[teambuilderFormat] = {
								id: teambuilderFormat,
								name: teambuilderFormatName,
								team,
								section,
								column,
								rated: false,
								isTeambuilderFormat: true,
								effectType: 'Format',
							};
						}
						isTeambuilderFormat = false;
					}
				}
				if (BattleFormats[id] && BattleFormats[id].isTeambuilderFormat) {
					isTeambuilderFormat = true;
				}
				// make sure formats aren't out-of-order
				if (BattleFormats[id]) delete BattleFormats[id];
				BattleFormats[id] = {
					id,
					name,
					team,
					section,
					column,
					searchShow,
					challengeShow,
					tournamentShow,
					rated: searchShow && id.substr(4, 7) !== 'unrated',
					teambuilderLevel,
					teambuilderFormat,
					isTeambuilderFormat,
					effectType: 'Format',
				};
			}
		}

		// Match base formats to their variants, if they are unavailable in the server.
		let multivariantFormats: {[id: string]: 1} = {};
		for (let id in BattleFormats) {
			let teambuilderFormat = BattleFormats[BattleFormats[id].teambuilderFormat!];
			if (!teambuilderFormat || multivariantFormats[teambuilderFormat.id]) continue;
			if (!teambuilderFormat.searchShow && !teambuilderFormat.challengeShow && !teambuilderFormat.tournamentShow) {
				// The base format is not available.
				if (teambuilderFormat.battleFormat) {
					multivariantFormats[teambuilderFormat.id] = 1;
					teambuilderFormat.battleFormat = '';
				} else {
					teambuilderFormat.battleFormat = id;
				}
			}
		}
		PS.teams.update('format');
	}
	handlePM(user1: string, user2: string, message: string) {
		const userid1 = toID(user1);
		const userid2 = toID(user2);
		const roomid = `pm-${[userid1, userid2].sort().join('-')}` as RoomID;
		let room = PS.rooms[roomid];
		if (!room) {
			const pmTarget = PS.user.userid === userid1 ? user2 : user1;
			PS.addRoom({
				id: roomid,
				pmTarget,
			}, true);
			room = PS.rooms[roomid]!;
		}
		room.receive(`|c|${user1}|${message}`);
		PS.update();
	}
	handleQueryResponse(id: ID, response: any) {
		switch (id) {
		case 'userdetails':
			let userid = response.userid;
			let userdetails = this.userdetailsCache[userid];
			if (!userdetails) {
				this.userdetailsCache[userid] = response;
			} else {
				Object.assign(userdetails, response);
			}
			const userRoom = PS.rooms[`user-${userid}`] as UserRoom;
			if (userRoom) userRoom.update('');
			break;
		case 'rooms':
			this.roomsCache = response;
			const roomsRoom = PS.rooms[`rooms`] as RoomsRoom;
			if (roomsRoom) roomsRoom.update('');
			break;
		}
	}
}

class MainMenuPanel extends PSRoomPanel {
	focus() {
		(this.base!.querySelector('button.big') as HTMLButtonElement).focus();
	}
	render() {
		const onlineButton = ' button' + (PS.isOffline ? ' disabled' : '');
		const searchButton = (PS.down ? <div class="menugroup" style="background: rgba(10,10,10,.6)">
			{PS.down === 'ddos' ?
				<p class="error"><strong>Pok&eacute;mon Showdown is offline due to a DDoS attack!</strong></p> :
				<p class="error"><strong>Pok&eacute;mon Showdown is offline due to technical difficulties!</strong></p>}
			<p>
				<div style={{textAlign: 'center'}}>
					<img width="96" height="96" src="//play.pokemonshowdown.com/sprites/bw/teddiursa.png" alt="" />
				</div>
				Bear with us as we freak out.
			</p>
			<p>(We'll be back up in a few hours.)</p>
		</div> : <div class="menugroup">
			<p>
				<FormatDropdown />
			</p>
			<p>
				<TeamDropdown format="gen7ou" />
			</p>
			<p><button class={"mainmenu1 big" + onlineButton} name="search">
				<strong>Battle!</strong><br />
				<small>Find a random opponent</small>
			</button></p>
		</div>);
		return <PSPanelWrapper room={this.props.room}>
			<div class="mainmenuwrapper">
				<div class="leftmenu">
					<div class="activitymenu">
						<div class="pmbox">
							<div class="pm-window news-embed" data-newsid="<!-- newsid -->">
								<h3>
									<button class="closebutton" tabIndex={-1}><i class="fa fa-times-circle"></i></button>
									<button class="minimizebutton" tabIndex={-1}><i class="fa fa-minus-circle"></i></button>
									News
								</h3>
								<div class="pm-log" style="max-height:none">
									<div class="newsentry">
										<h4>Test client</h4>
										<p>Welcome to the test client! You can test client changes here!</p>
										<p>&mdash;<strong>Zarel</strong> <small class="date">on Sep 25, 2015</small></p>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="mainmenu">
						{searchButton}

						<div class="menugroup">
							<p><button class="mainmenu2 button" name="joinRoom" value="teambuilder">Teambuilder</button></p>
							<p><button class={"mainmenu3" + onlineButton} name="joinRoom" value="ladder">Ladder</button></p>
						</div>

						<div class="menugroup">
							<p><button class={"mainmenu4" + onlineButton} name="joinRoom" value="battles">Watch a battle</button></p>
							<p><button class={"mainmenu5" + onlineButton} name="finduser">Find a user</button></p>
						</div>
					</div>
				</div>
				<div class="rightmenu" style={{display: PS.leftRoomWidth ? 'none' : 'block'}}>
					<div class="menugroup">
						{PS.server.id === 'showdown' ?
							<p><button class={"mainmenu1" + onlineButton} name="joinRoom" value="rooms">Join chat</button></p>
						:
							<p><button class={"mainmenu1" + onlineButton} name="joinRoom" value="lobby">Join lobby chat</button></p>
						}
					</div>
				</div>
				<div class="mainmenufooter">
					<div class="bgcredit"></div>
					<small>
						<a href="//dex.pokemonshowdown.com/" target="_blank">Pok&eacute;dex</a> | {}
						<a href="//replay.pokemonshowdown.com/" target="_blank">Replays</a> | {}
						<a href="//pokemonshowdown.com/rules" target="_blank">Rules</a> | {}
						<a href="//pokemonshowdown.com/credits" target="_blank">Credits</a> | {}
						<a href="http://smogon.com/forums/" target="_blank">Forum</a>
					</small>
				</div>
			</div>
		</PSPanelWrapper>;
	}
}

class FormatDropdown extends preact.Component<{}> {
	getFormat() {
		if (this.base) {
			return (this.base as HTMLButtonElement).value;
		}
		return 'gen7randombattle';
	}
	change = () => this.forceUpdate();
	render() {
		const format = this.getFormat();
		return <button class="select formatselect" name="format" data-href="/formatdropdown" onChange={this.change}>
			{format}
		</button>;
	}
}

class TeamDropdown extends preact.Component<{format: string}> {
	getTeam() {
		if (this.base) {
			const key = (this.base as HTMLButtonElement).value;
			return PS.teams.byKey[key] || null;
		}
		for (const team of PS.teams.list) {
			if (team.format === this.props.format) return team;
		}
		return null;
	}
	change = () => this.forceUpdate();
	render() {
		const format = this.props.format;
		const team = this.getTeam();
		let teambox = null;
		if (PS.roomTypes['teamdropdown']) {
			teambox = <TeamBox team={team} noLink />;
		}
		return <button class="select teamselect" name="team" data-href="/teamdropdown" data-format={format} onChange={this.change}>
			{teambox}
		</button>;
	}
}

PS.roomTypes['mainmenu'] = {
	Model: MainMenuRoom,
	Component: MainMenuPanel,
};
