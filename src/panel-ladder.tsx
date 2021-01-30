/**
 * Ladder Panel
 *
 * Panel for ladder formats and associated ladder tables.
 *
 * @author Adam Tran <aviettran@gmail.com>
 * @license MIT
 */

class LadderRoom extends PSRoom {
	readonly classType: string = 'ladder';
	readonly format?: string = this.id.split('-')[1];
	notice?: string;
	searchValue: string = '';
	lastSearch: string = '';
	loading: boolean = false;
	error?: string;
	ladderData?: string;

	setNotice = (notice: string) => {
		this.notice = notice;
		this.update(null);
	};
	setSearchValue = (searchValue: string) => {
		this.searchValue = searchValue;
		this.update(null);
	};
	setLastSearch = (lastSearch: string) => {
		this.lastSearch = lastSearch;
		this.update(null);
	};
	setLoading = (loading: boolean) => {
		this.loading = loading;
		this.update(null);
	};
	setError = (error: Error) => {
		this.loading = false;
		this.error = error.message;
		this.update(null);
	};
	setLadderData = (ladderData: string | undefined) => {
		this.loading = false;
		this.ladderData = ladderData;
		this.update(null);
	};
	requestLadderData = (searchValue?: string) => {
		const { teams } = PS;
		if (teams.usesLocalLadder) {
			this.send(`/cmd laddertop ${this.format} ${toID(this.searchValue)}`);
		} else if (this.format !== undefined) {
			Net('/ladder.php')
				.get({
					query: {
						format: this.format,
						server: Config.server.id.split(':')[0],
						output: 'html',
						prefix: toID(searchValue),
					},
				})
				.then(this.setLadderData)
				.catch(this.setError);
		}
		this.setLoading(true);
	};
}

function LadderBackToFormatList(room: PSRoom) {
	return () => {
		PS.removeRoom(room);
		PS.join("ladder" as RoomID);
	};
}

function LadderFormat(props: { room: LadderRoom }) {
	const { teams } = PS;
	const { room } = props;
	const {
		format, searchValue, lastSearch, loading, error, ladderData,
		setSearchValue, setLastSearch, requestLadderData,
	} = room;
	if (format === undefined) return null;

	const changeSearch = (e: Event) => {
		setSearchValue((e.currentTarget as HTMLInputElement).value);
	};
	const submitSearch = (e: Event) => {
		e.preventDefault();
		setLastSearch(room.searchValue);
		requestLadderData(room.searchValue);
	};
	const RenderHeader = () => {
		if (!teams.usesLocalLadder) {
			return <h3>
				{BattleLog.escapeFormat(format)} Top{" "}
				{BattleLog.escapeHTML(lastSearch ? `- '${lastSearch}'` : "500")}
			</h3>;
		}
		return null;
	};
	const RenderSearch = () => {
		if (!teams.usesLocalLadder) {
			return <form class="search" onSubmit={submitSearch}>
				<input
					type="text"
					name="searchValue"
					class="textbox searchinput"
					value={BattleLog.escapeHTML(searchValue)}
					placeholder="username prefix"
					onChange={changeSearch}
				/>
				<button type="submit"> Search</button>
			</form>;
		}
		return null;
	};
	const RenderFormat = () => {
		if (loading || !BattleFormats) {
			return <p>Loading...</p>;
		} else if (error !== undefined) {
			return <p>Error: {error}</p>;
		} else if (BattleFormats[format] === undefined) {
			return <p>Format {format} not found.</p>;
		} else if (ladderData === undefined) {
			return null;
		}
		return (
			<>
				<p>
					<button
						class="button"
						onClick={() => requestLadderData(lastSearch)}
					>
						<i class="fa fa-refresh"></i> Refresh
					</button>
					<RenderSearch/>
				</p>
				<RenderHeader/>
				<SanitizedHTML>{ladderData}</SanitizedHTML>
			</>
		);
	};
	return (
		<div class="ladder pad">
			<p>
				<button onClick={LadderBackToFormatList(room)}>
					<i class="fa fa-chevron-left"></i> Format List
				</button>
			</p>
			<RenderFormat />
		</div>
	);
}

class LadderPanel extends PSRoomPanel<LadderRoom> {
	componentDidMount() {
		const { room } = this.props;
		// Request ladder data either on mount or after BattleFormats are loaded
		if (BattleFormats && room.format !== undefined) room.requestLadderData();
		this.subscriptions.push(
			room.subscribe((response: any) => {
				if (response) {
					const [format, ladderData] = response;
					if (room.format === format) {
						if (!ladderData) {
							room.setError(new Error('No data returned from server.'));
						} else {
							room.setLadderData(ladderData);
						}
					}
				}
				this.forceUpdate();
			})
		);
		this.subscriptions.push(
			PS.teams.subscribe(() => {
				if (room.format !== undefined) room.requestLadderData();
				this.forceUpdate();
			})
		);
	}
	static Notice = (props: { notice: string | undefined }) => {
		const { notice } = props;
		if (notice) {
			return (
				<p>
					<strong style="color:red">{notice}</strong>
				</p>
			);
		}
		return null;
	};
	static BattleFormatList = () => {
		if (!BattleFormats) {
			return <p>Loading...</p>;
		}
		let currentSection: string = "";
		let sections: JSX.Element[] = [];
		let formats: JSX.Element[] = [];
		for (const [key, format] of Object.entries(BattleFormats)) {
			if (!format.rated || !format.searchShow) continue;
			if (format.section !== currentSection) {
				if (formats.length > 0) {
					sections.push(
						<preact.Fragment key={currentSection}>
							<h3>{currentSection}</h3>
							<ul style="list-style:none;margin:0;padding:0">
								{formats}
							</ul>
						</preact.Fragment>
					);
					formats = [];
				}
				currentSection = format.section;
			}
			formats.push(
				<li key={key} style="margin:5px">
					<button
						name="joinRoom"
						value={`ladder-${key}`}
						class="button"
						style="width:320px;height:30px;text-align:left;font:12pt Verdana"
					>
						{BattleLog.escapeFormat(format.id)}
					</button>
				</li>
			);
		}
		return <>{sections}</>;
	};
	static ShowFormatList = (props: { room: LadderRoom }) => {
		const { room } = props;
		return (
			<>
				<p>
					See a user's ranking with{" "}
					<a
						class="button"
						href={`/${Config.routes.users}/`}
						target="_blank"
					>
						User lookup
					</a>
				</p>
				<LadderPanel.Notice notice={room.notice} />
				<p>
					(btw if you couldn't tell the ladder screens aren't done yet;
					they'll look nicer than this once I'm done.)
				</p>
				<p>
					<button name="joinRoom" value="view-ladderhelp" class="button">
						<i class="fa fa-info-circle"></i> How the ladder works
					</button>
				</p>
				<LadderPanel.BattleFormatList />
			</>
		);
	};
	render() {
		const { room } = this.props;
		return (
			<PSPanelWrapper room={room} scrollable>
				<div class="ladder pad">
					{room.format === undefined && (
						<LadderPanel.ShowFormatList room={room} />
					)}
					{room.format !== undefined && <LadderFormat room={room} />}
				</div>
			</PSPanelWrapper>
		);
	}
}

PS.roomTypes['ladder'] = {
	Model: LadderRoom,
	Component: LadderPanel,
};
PS.updateRoomTypes();
