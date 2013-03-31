<?php

/*

License: GPLv2 or later
  <http://www.gnu.org/licenses/gpl-2.0.html>

*/

error_reporting(E_ALL);

include_once '../pokemonshowdown.com/lib/ntbb-session.lib.php';
//include_once 'lib/ntbb-ladder.lib.php';
include_once '../pokemonshowdown.com/config/servers.inc.php';

function getServerHostName($serverid) {
	global $PokemonServers;
	if (empty($serverid)) $serverid = 'showdown';
	$server = @$PokemonServers[$serverid];
	return $server ? $server['server'] : $serverid;
}

function verifyCrossDomainRequest() {
	global $multiReqs, $config;
	// No cross-domain multi-requests for security reasons.
	// No need to do anything if this isn't a cross-domain request.
	if ($multiReqs || !isset($_SERVER['HTTP_ORIGIN'])) {
		return '';
	}

	$origin = $_SERVER['HTTP_ORIGIN'];
	$prefix = null;
	foreach ($config['cors'] as $i => &$j) {
		if (!preg_match($i, $origin)) continue;
		$prefix = $j;
		break;
	}
	if ($prefix === null) {
		// Bogus request.
		return '';
	}

	// Valid CORS request.
	header('Access-Control-Allow-Origin: ' . $origin);
	header('Access-Control-Allow-Credentials: true');
	return $prefix;
}

function findServer() {
	global $PokemonServers, $reqData, $users;

	$serverid = @$reqData['serverid'];
	$server = null;
	$ip = $users->getIp();
	if (!isset($PokemonServers[$serverid])) {
		// Try to find the server by source IP, rather than by serverid.
		foreach ($PokemonServers as &$i) {
			if (empty($i['ipidentification'])) continue;
			if (!isset($i['ipcache'])) {
				$i['ipcache'] = gethostbyname($i['server']);
			}
			if ($i['ipcache'] === $ip) {
				$server =& $i;
				break;
			}
		}
		if (!$server) return null;
	} else {
		$server =& $PokemonServers[$serverid];
		if (empty($server['skipipcheck'])) {
			if (!isset($server['ipcache'])) {
				$server['ipcache'] = gethostbyname($server['server']);
			}
			if ($ip !== $server['ipcache']) return null;
		}
	}
	if (!empty($server['token'])) {
		if ($server['token'] !== md5($reqData['servertoken'])) return null;
	}
	return $server;
}

$reqs = array($_REQUEST);
$multiReqs = false;
if (@$_REQUEST['json']) {
	$reqs = json_decode($_REQUEST['json'], true);
	$multiReqs = true;
}

$outPrefix = ']'; // JSON output should not be valid JavaScript
$outArray = array();

foreach ($reqs as $reqData) {

	$reqData = array_merge($_REQUEST, $reqData);
	if (!ctype_alnum(@$reqData['act'])) die('{"error":"invalid action"}');
	$out = array(
		'action' => @$reqData['act']
	);

	switch (@$reqData['act']) {
	case 'login':
		if (!$_POST || empty($reqData['name']) || empty($reqData['pass'])) die();
		$users->login($reqData['name'], $reqData['pass']);
		unset($curuser['userdata']);
		$out['curuser'] = $curuser;
		$out['actionsuccess'] = !!$curuser;
		$serverhostname = '' . getServerHostName(@$reqData['serverid']);
		if ($curuser && $serverhostname) {
			$out['sessiontoken'] = $users->getSessionToken($serverhostname) . '::' . $serverhostname;
		}
		$challengekeyid = !isset($reqData['challengekeyid']) ? -1 : intval($reqData['challengekeyid']);
		$challenge = !isset($reqData['challenge']) ? '' : $reqData['challenge'];
		$challengeprefix = verifyCrossDomainRequest();
		$out['assertion'] = $users->getAssertion($curuser['userid'], $serverhostname, null,
			$challengekeyid, $challenge, $challengeprefix);
		$out['sid'] = $users->sid;
		break;
	case 'register':
		$serverhostname = '' . getServerHostName(@$reqData['serverid']);
		$user = array();
		$user['username'] = @$_POST['username'];
		$userid = $users->userid($user['username']);
		if (strlen($userid) < 1) {
			$out['actionerror'] = 'Your username must contain at least one letter or number.';
		} else if (substr($userid, 0, 5) === 'guest') {
			$out['actionerror'] = 'Your username cannot start with \'guest\'.';
		} else if (strlen($user['username']) > 18) {
			$out['actionerror'] = 'Your username must be less than 19 characters long.';
		} else if (strlen(@$_POST['password']) < 5) {
			$out['actionerror'] = 'Your password must be at least 5 characters long.';
		} else if (@$_POST['password'] !== @$_POST['cpassword']) {
			$out['actionerror'] = 'Your passwords do not match.';
		} else if (trim(strtolower(@$_POST['captcha'])) !== 'pikachu') {
			$out['actionerror'] = 'Please answer the anti-spam question given.';
		} else if (($registrationcount = $users->getRecentRegistrationCount()) === false) {
			$out['actionerror'] = 'A database error occurred. Please try again.';
		} else if ($registrationcount >= 2) {
			$out['actionerror'] = 'You can\'t register more than two usernames every two hours. Try again later.';
		} else if ($user = $users->addUser($user, $_POST['password'])) {
			$challengekeyid = !isset($reqData['challengekeyid']) ? -1 : intval($reqData['challengekeyid']);
			$challenge = !isset($reqData['challenge']) ? '' : $reqData['challenge'];
			$challengeprefix = verifyCrossDomainRequest();
			$out['curuser'] = $user;
			$out['assertion'] = $users->getAssertion($user['userid'],
					$serverhostname, $user, $challengekeyid, $challenge, $challengeprefix);
			$out['sid'] = $users->sid;
			$out['actionsuccess'] = true;
			if ($curuser && $serverhostname) {
				$out['sessiontoken'] = $users->getSessionToken($serverhostname) . '::' . $serverhostname;
			}
		} else {
			$out['actionerror'] = 'Your username is already taken.';
		}
		break;
	case 'logout':
		if (!$_POST) die();
		$users->logout();
		$out['curuser'] = $curuser;
		$out['actionsuccess'] = true;
		break;
	case 'getassertion':
		// direct
		$serverhostname = '' . getServerHostName(@$reqData['serverid']);
		$challengekeyid = !isset($reqData['challengekeyid']) ? -1 : intval($reqData['challengekeyid']);
		$challenge = !isset($reqData['challenge']) ? '' : $reqData['challenge'];
		$challengeprefix = verifyCrossDomainRequest();
		header('Content-type: text/plain; charset=utf-8');
		if (empty($reqData['userid'])) {
			$userid = $curuser['userid'];
			if ($userid === 'guest') {
				// Special error message for this case.
				die(';');
			}
		} else {
			$userid = $users->userid($reqData['userid']);
		}
		$serverhostname = htmlspecialchars($serverhostname);	// Protect against theoretical IE6 XSS
		die($users->getAssertion($userid, $serverhostname, null, $challengekeyid, $challenge, $challengeprefix));
		break;
	case 'updateuserstats':
		$server = findServer();
		if (!$server) {
			$out = 0;
			break;
		}

		$date = @$reqData['date'];
		$usercount = @$reqData['users'];
		if (!is_numeric($date) || !is_numeric($usercount)) {
			$out = 0;
			break;
		}

		$out = !!$db->query(
			"INSERT INTO `ntbb_userstats` (`serverid`, `date`, `usercount`) " .
				"VALUES ('" . $db->escape($server['id']) . "', '" . $db->escape($date) . "', '" . $db->escape($usercount) . "') " .
				"ON DUPLICATE KEY UPDATE `date`='" . $db->escape($date) . "', `usercount`='" . $db->escape($usercount) . "'");

		if ($server['id'] === 'showdown') {
			$db->query(
				"INSERT INTO `ntbb_userstatshistory` (`date`, `usercount`) " .
				"VALUES ('" . $db->escape($date) . "', '" . $db->escape($usercount) . "')");
		}
		$outprefix = '';
		break;
	case 'ladderupdate':
		include_once 'lib/ntbb-ladder.lib.php';
		
		$server = findServer();
		if (!$server) {
			$out = 0;
			break;
		}
		
		$ladder = new NTBBLadder($server['id'], $reqData['format']);
		$p1 = $users->getUserData($reqData['p1']);
		$p2 = $users->getUserData($reqData['p2']);
			
		$ladder->updateRating($p1, $p2, floatval($reqData['score']));
		$out['actionsuccess'] = true;
		$out['p1rating'] = $p1['rating'];
		$out['p2rating'] = $p2['rating'];
		unset($out['p1rating']['rpdata']);
		unset($out['p2rating']['rpdata']);
		$outPrefix = '';	// No need for prefix since only usable by server.
		break;
	case 'prepreplay':
		include_once 'lib/ntbb-ladder.lib.php';
		
		$server = findServer();
		if (!$server) {
			$out = 0;
			break;
		}
		
		if (@$server['id'] !== 'showdown') break; // let's not think about other servers yet
		
		$res = $db->query("SELECT * FROM `ntbb_replays` WHERE `id`='".$db->escape($reqData['id'])."','".$db->escape($reqData['loghash'])."'");
		$replay = $db->fetch_assoc($res);
		
		if ($replay && !$replay['loghash']) {
			$out = !!$db->query("UPDATE `ntbb_replays` SET `loghash` = '".$db->escape($reqData['loghash'])."' WHERE `id`='".$db->escape($reqData['id'])."','".$db->escape($reqData['loghash'])."'");
		} else {
			$out = !!$db->query("INSERT INTO `ntbb_replays` (`id`,`loghash`,`p1`,`p2`,`format`,`date`) VALUES ('".$db->escape($reqData['id'])."','".$db->escape($reqData['loghash'])."','".$db->escape($reqData['p1'])."','".$db->escape($reqData['p2'])."','".$db->escape($reqData['format'])."',".time().")");
		}
		$outPrefix = '';	// No need for prefix since only usable by server.
		break;
	case 'uploadreplay':
		function stripNonAscii($str) { return preg_replace('/[^(\x20-\x7F)]+/','', $str); }
		if (!$_POST['id']) die('ID needed');
		$id = $_POST['id'];

		$res = $db->query("SELECT * FROM `ntbb_replays` WHERE `id` = '".$db->escape($id)."'");
		
		$replay = $db->fetch_assoc($res);
		if (!$replay) die('not found');
		if (md5(stripNonAscii($_POST['log'])) !== $replay['loghash']) {
			$_POST['log'] = str_replace("\r",'', $_POST['log']);
			if (md5(stripNonAscii($_POST['log'])) !== $replay['loghash']) {
				die('hash mismatch');
			}
		}

		$db->query("UPDATE `ntbb_replays` SET `log` = '".$db->escape($_POST['log'])."', `loghash` = '' WHERE `id` = '".$db->escape($id)."'");

		die('success');
		break;
	case 'ladderget':
		include_once 'lib/ntbb-ladder.lib.php';
		
		$server = $PokemonServers[$reqData['serverid']];
		if (!$server) die('');
		
		$ladder = new NTBBLadder($server['id'], @$reqData['format']);
		$user = $users->getUserData($reqData['user']);
		$ladder->getAllRatings($user);
		header('Content-type: application/json');
		die($outPrefix . json_encode($user['ratings']));
		break;
	case 'ladderformatgetmmr':
	case 'mmr':
		include_once 'lib/ntbb-ladder.lib.php';

		$server = $PokemonServers[$reqData['serverid']];
		if (!$server) die('');

		$ladder = new NTBBLadder($server['id'], @$reqData['format']);
		$user = $users->getUserData($reqData['user']);
		$ladder->getRating($user);
		if (!@$user['rating']) {
			$out = 1500;
		} else {
			$out = ($user['rating']['r']+$user['rating']['rpr'])/2;
		}
		break;
	}

	if ($multiReqs) $outArray[] = $out;
}

// json output
if ($multiReqs) {
	header('Content-type: application/json');
	die($outPrefix . json_encode($outArray));
} else {
	header('Content-type: application/json');
	die($outPrefix . json_encode($out));
}
