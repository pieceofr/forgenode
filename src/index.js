//Electron
const electron = require('electron'); //Electron
const { app, BrowserWindow } = require('electron');
const {Menu} = require('electron'); //Electron Default Menu
const path = require('path'); //Used to interact with file paths
//const os = require('os'); //Used to determine the user's current OS
var fs = require('fs'); //Used to check to see if directories exist/create ones

//Third Party Lib
const settings = require('electron-settings'); //Electron-Settings - Used to store user settings (https://github.com/nathanbuchar/electron-settings)
const publicIp = require('public-ip'); //Public-IP - Used to get external IP address (https://github.com/sindresorhus/public-ip)
const notifier = require('node-notifier'); //Notifications (https://www.npmjs.com/package/node-notifier)
const { exec } = require('child_process'); //Electron Default Child Process - Used to run CLI commands
const windowStateKeeper = require('electron-window-state'); //Electron-Window-State - Keep window state from instances of program (https://www.npmjs.com/package/electron-window-state)
const userHome = require('user-home'); //User-Home (https://github.com/sindresorhus/user-home)


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow, prefWindow;

var containerState, prevState;
//Set dataDirectory
var dataDir = `${userHome}`;
//Check if platform is windows
var isWin = process.platform === "win32";
if(isWin){
	//Update to correct Windows User Directory
	dataDir = `${userHome}\\AppData\\Roaming`;
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function() {
	//Ensure settings are initialized on startup
	
	//reloadMainWindow()

	// Load the previous state with fallback to defaults
	let mainWindowState = windowStateKeeper({
	  defaultWidth: 1200,
	  defaultHeight: 800
	});
		
	// Create the window using the state information
	mainWindow = new BrowserWindow({
		// Set window location and size as what is was on close
		'x': mainWindowState.x,
		'y': mainWindowState.y,
		width: mainWindowState.width,
		height: mainWindowState.height,
		minWidth: 985,
		minHeight: 440,
		title: "Bitmark Node User Interface",
		icon: path.join(__dirname, 'assets/icons/app_icon.png'),
    	frame: false,
    	trasparent: true,
    	darkTheme: true
	});
  settingSetup();
	//Load the webpage
	//mainWindow.loadURL(`file://${__dirname}/index.html`);
  reloadMainWin();
	containerCheck();
	// Emitted when the window is closed.
	mainWindow.on('closed', () => {
	  // Dereference the window object, usually you would store windows
	  // in an array if your app supports multi windows, this is the time
	  // when you should delete the corresponding element.
	  mainWindow = null;
	  app.quit();
	});

	// Let us register listeners on the window, so we can update the state
	// automatically (the listeners will be removed when the window is closed)
	// and restore the maximized or full screen state
	mainWindowState.manage(mainWindow);
	//Check for check for updates if auto update is on after 2 seconds
	setTimeout(autoUpdateCheck, 5000);
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  console.log('windows close')
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});
//Check to see if settings are initialized
function settingSetup(){
	if(settings.get('network') === undefined){ settings.set('network', 'bitmark'); }
	if(settings.get('auto_update') === undefined){ settings.set('auto_update', true); }
  if(settings.get('directory') === undefined){ settings.set('directory', dataDir); }
  if(containerState === undefined){containerState='norun';}
  if(prevState === undefined){prevState='undefined';}
};
//Display notification with str text
function newNotification(str){
	notifier.notify(
		{
			title: "Bitmark Node",
			message: `${str}`,
			icon: path.join(__dirname, 'assets/icons/app_icon.png'),
			sound: true,
			wait: false
		}
	);
};
//Pull update if auto_update is on
function autoUpdateCheck(){
	//get the auto update value
	const auto_update = settings.get('auto_update');
	if(auto_update === true){
		console.log("Checking for updates with auto updater");
		pullUpdate();
	}
};
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

function winLoadPage(page) {
	switch(page) {
		case 'index':
		case 'init':
		case 'preferences':
			mainWindow.loadURL(`file://${__dirname}/`+ page + `.html`);	
			console.log('mainwindows load  ', page, '.html')
			break;
		case 'test':
			console.log('test.html ')
			mainWindow.loadFile('test.html')
			break;
		default:
			console.log('mainwindows load fail. no such page ')
	}
};

function getState() {
  return containerState;
}
function getPrevState() {
  return prevState;
}

function setContainerState(state) {
  prevState =  getState();
  state ? containerState='run': containerState='norun';
  console.log('setContainerState:', getState(), ' prev:',getPrevState())
};

function reloadMainWin() {
  console.log('reloadMainWin prevState:', getPrevState(), 'curState:', getState())
  if (getState() ==  getPrevState()) { // state not change, do not need to reload page
    console.log('no need to change ui')
    return
  }
	switch (getState()) {
		case 'run': 
      winLoadPage('index')
			break;
		default:
      winLoadPage('init')
			break;
	}
};

/**
 * External Functions
 */

function isContainerRunning() {
  //Get the container status of bitmarkNode
  return new Promise(function(){
    exec("docker inspect -f '{{.State.Running}}' bitmarkNode", (err, stdout, stderr) => {
      //If the container is not setup, create it (no container exist)
      if (err) {
        return false;
      } else{
         //If the container is stopped, start it
        var str = stdout.toString().trim();
        if(str === "true"){
          return true;
        }
        return false;
      }
    });
  });
}


function containerCheck(){

	//Get the container status of bitmarkNode
	exec("docker inspect -f '{{.State.Running}}' bitmarkNode", (err, stdout, stderr) => {
	  //If the container is not setup, create it (no container exist)
	  if (err) {
      console.log('inspect Docker failed');
      setContainerState(false);
      reloadMainWin();
		  createContainerHelper();//Start to Create Container
	  } else{
       //If the container is stopped, start it
      var str = stdout.toString().trim();
      if(str.includes('false')){
        console.log('check container false');
        startBitmarkNode_noNotif();
      //mainWindow.reload();
      } else { // if docker is running
        console.log('check container true');
        setContainerState(true)
        reloadMainWin()
      }
    }
	});
};

// Create the container with the network and directory given
function createContainerHelper(){
  const net = settings.get('network');
	const dir = settings.get('directory');
	//If the OS is Windows check to see if the user is logged in
	if(isWin){
		//Check to make sure the user is logged in
		exec("docker login", (err, stdout, stderr) => {
			//Get the output
			var str = stdout.toString();

			console.log(`err: ${err}`);
			console.log(`Stdout: ${stdout}`);
			console.log(`Stderr: ${stderr}`);

			//Is the user is logged in, create the container
			if(str.indexOf("Login Succeeded") !== -1){
				//Get the user's IP and create the container
				console.log("Docker is logged in");
				publicIp.v4().then(ip => {
				  createContainer(ip, net, dir, isWin);
				});
			//If the user is not logged in let them know, and quit
			}else{
        setContainerState(false);
        reloadMainWin();
				newNotification("Docker is not logged in. Please login into the Docker application and retry.");
				console.log("Docker is not logged in");
				return;
			}
		});
	//Create the container is the OS isn't windows
	}else{
		//Get the users public IP
		publicIp.v4().then(ip => {
		  createContainer(ip, net, dir, isWin);
		});
	}
}


//Create the docker container
function createContainer(ip, net, dir, isWin){
	//Check to make sure the needed directories exist
  validDir = directoryCheckHelper(dir);
  if (!validDir){
    setContainerState(false);
    reloadMainWin();
    return false;
  } // If directory check failed, return false;

	//Attempt to remove and stop the container before creating the container.
	exec("docker stop bitmarkNode", (err, stdout, stderr) => {
		exec("docker rm bitmarkNode", (err, stdout, stderr) => {
			//Use the command suited for the platform
	    if(isWin){
	    		//The windows command is the same as the linux command, except with \\ (\\ to delimit the single backslash) instead of /
	    		console.log("Windows");
	    		var command = `docker run -d --name bitmarkNode -p 9980:9980 -p 2136:2136 -p 2130:2130 -e PUBLIC_IP=${ip} -e NETWORK=${net} -v ${dir}\\bitmark-node-data\\db:\\.config\\bitmark-node\\db -v ${dir}\\bitmark-node-data\\data:\\.config\\bitmark-node\\bitmarkd\\bitmark\\data -v ${dir}\\bitmark-node-data\\data-test:\\.config\\bitmark-node\\bitmarkd\\testing\\data bitmark/bitmark-node`
			}else{
				console.log("Non-Windows");
	    		var command = `docker run -d --name bitmarkNode -p 9980:9980 -p 2136:2136 -p 2130:2130 -e PUBLIC_IP=${ip} -e NETWORK=${net} -v ${dir}/bitmark-node-data/db:/.config/bitmark-node/db -v ${dir}/bitmark-node-data/data:/.config/bitmark-node/bitmarkd/bitmark/data -v ${dir}/bitmark-node-data/data-test:/.config/bitmark-node/bitmarkd/testing/data bitmark/bitmark-node`
	    }
	    	
	    	//Run the command
	    	exec(command, (err, stdout, stderr) => {
	    		if (err) {
            setContainerState(false);
            reloadMainWin();
            newNotification("The Docker container failed to be created. Ensure you're connected to the Internet and Docker is running properly.");
        		return;
          }
          setContainerState(true);
          reloadMainWin();
          console.log(`${stdout}`);
	    		newNotification("The Docker container was created successfully. Please refresh you window.");
	    	});
		});
  });
};

// Check for updates from bitmark/bitmark-node
function pullUpdate(){

	newNotification("Checking for updates. This may take some time.");
	//Pull updates from the docker bitmark-node repo
	exec("docker pull bitmark/bitmark-node", (err, stdout, stderr) => {
	  if (err) {
		  console.log("Failed to pull update");
	    newNotification("There was an error checking for an update. Please check your Internet connection and restart the Docker application.");
	    return;
	  }

	  //get the output
	  var str = stdout.toString();

	  //Check to see if the up to date text is present
	  if(str.indexOf("Image is up to date for bitmark/bitmark-node") !== -1){
		  console.log("No Updates");
	  	newNotification("No updates to the Bitmark Node software have been found.");
	  }
	  //Check to see if the updated text is present
	  else if(str.indexOf("Downloaded newer image for bitmark/bitmark-node") !== -1){
	  	console.log("Updated");
	  	newNotification("The Bitmark Node software has downloaded. Installing updates now.");
      createContainerHelper();
	  	newNotification("The Bitmark Node software has been updated.");
	  }else{
      console.log("Unknown update error");
      setAppState('failUpdate');
      isRunning = isContainerRunning();
      isRunning.then(function(result) {
        if (result) {
          setContainerState(true);
        } else {
          setContainerState(false);
        }
        reloadMainWin();
    }, function(err) {
      setContainerState(false);
      reloadMainWin();
      console.log("check container error");
    })
    newNotification("There was an error checking for an update. Please check your Internet connection and restart the Docker application.");

	  }

	});
};

// Start the bitmarkNode Docker container without a notification
function startBitmarkNode_noNotif(){
	//Start the container named bitmarkNode
	exec("docker start bitmarkNode", (err, stdout, stderr) => {
	  if (err) {
		// node couldn't execute the command
      setContainerState(false);
      reloadMainWin();
	    console.log("Failed to start container");
	    return;
	  }
    setContainerState(true);
    console.log("Start container");
	  console.log(`${stdout}`);
    reloadMainWin();
	});
};
/* Directory Functions */
//Check to see if dir is defined and if not create it
function directoryCheck(dir){
	//If the directory doesn't exist, create it
	if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
      console.log(`The directory ${dir} does not exist. Creating it now.`);
      if (!fs.existsSync(dir)){
        console.log(`The directory ${dir} create fail.`);
        return false;
      }
      return true;
	}else{
    console.log("The directory exists.")
    return true;
	}
};

//Check directories
function directoryCheckHelper(dir) {

	//Get each directory and store it in a variable
	const folder = dir;
	var bitmarknode = `${folder}/bitmark-node-data`;
	var db = `${bitmarknode}/db`;
	var data = `${bitmarknode}/data`;
	var datatest = `${bitmarknode}/data-test`;

	//Pass each variable to directoryCheck
	if (!directoryCheck(bitmarknode)) {console.log('check bitmarknode dir fail'); return false;};
	if (!directoryCheck(db)){console.log('check db dir fail'); return false;};
	if (!directoryCheck(data)){console.log('check data dir fail');  return false;};
  if (!directoryCheck(datatest)){console.log('check datatest dir fail');  return false;};
  return true;
};

//Check to see if dir is defined and if not create it
function directoryCheck(dir){
	//If the directory doesn't exist, create it
	if (!fs.existsSync(dir)){
	    fs.mkdirSync(dir);
      console.log(`The directory ${dir} does not exist. Creating it now.`);
      if (!fs.existsSync(dir)) {
        return false;
      }
      return true;
	}else{
    console.log("The directory exists.")
    return true;
	}
};

/****
 *  Customerized Windows UI
 ****/
function createPreferencesWindow(){

	//Define the preferences window
	prefWindow = new BrowserWindow({
		width: 850,
		height: 600,
		minWidth: 735,
		minHeight: 500,
		title: "Preferences",
		icon: path.join(__dirname, 'assets/icons/app_icon.png'),
    	frame: false,
    	trasparent: true,
    	darkTheme: true
	});

	//load the preferences file
	prefWindow.loadURL(`file://${__dirname}/preferences.html`);

	// Emitted when the window is closed.
	prefWindow.on('closed', () => {
	  // Dereference the window object, usually you would store windows
	  // in an array if your app supports multi windows, this is the time
	  // when you should delete the corresponding element.
	  prefWindow = null;
	});
};
