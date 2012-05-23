///////////////////////////////////////////////////////
//global variables to hold the connection data
var gActorEmail;
var gActorName;
var gLRSAppId;
var gLRSAppSecretKey;

//////////////////////////////////////////////////////
//callback for successful sending of statement
//hides the "sending" gui, and caches the statment if there was 
//a failure
//param: e - the XHR object
/////////////////////////////////////////////////////////////
function SuccessCallback(e)
{			
		  //this is the successful submittion to the LRS
		  if(e.status == '204')
		  {
			  document.getElementById('statusText').innerHTML = "Success";
			  window.setTimeout(function(){parent.postMessage('closeTinCanBookmarklet',"*");document.getElementById('TinCanBookmarklet').parentElement.removeChild(document.getElementById('TinCanBookmarklet'));},500);
		  }
		  //if the status is lower than 400 but not 204, it should be 0. In this case, the connection failed. Cache the statement
		  else if(e.status < '400')
		  {
			  document.getElementById('statusText').innerHTML = "Cached";
			  CacheStatement(this.statement);
			  window.setTimeout(function(){parent.postMessage('closeTinCanBookmarklet',"*");document.getElementById('TinCanBookmarklet').parentElement.removeChild(document.getElementById('TinCanBookmarklet'));},500);
		  }else
		  //In this case, the status it 400 or higher. This means that the send failed, but not because a lack of connection
		  //therefore, show an alert, then pull up the prompt to allow the user to reenter the information
		  //This should never really happen, as you can't input bad connection data to start, but is possible
		  //if the LRS connection data changes after the user has entered it.
		  {
				alert(e.responseText);
				document.getElementById('TinCanBookmarklet').parentElement.removeChild(document.getElementById('TinCanBookmarklet'));
				ShowPrompt();
		  }
		  
}

///////////////////////////////////////////////////
//Get the cached statements.
//Return empty array if there are no cached statements
////////////////////////////////////////////////////
function getCache()
{
	var cache;
	if(localStorage['BookmarkletCache'] != null)
		cache = JSON.parse(localStorage['BookmarkletCache']);
	else
		cache = [];
	return cache;
}
////////////////////////////////////////////////////////
//add a statement to the cache
//param: statement - the statement to cache
//callback: an optional callback. Will be sent an object with status = 100;
///////////////////////////////////////////////////////
function CacheStatement(statement,callback)
{
	var cache = getCache();
	
	cache.push(statement);
	console.log('caching: count: ' + cache.length);
	localStorage['BookmarkletCache']	= JSON.stringify(cache);
	if(callback)
		callback({status:100});
}
////////////////////////////////////////////////////////////
//setup the statement to send to the LRS server
//param: callback - the callback to send to the XHR Request
function SendStatement(callback)
{
	console.log('sending');
	//Get the LRS connection object
	var tc_lrs = TCDriver_GetLRSObject();
	//Prepare the statement
	var statement = { actor: { "name":[gActorName], "mbox": ["mailto:" + gActorEmail] }, verb: "", object: { id: "", definition: { type: ""}} };
	var definition = statement.object.definition;
	//Set the statement verb
	statement.verb = "experienced";
	//Take to object ID from the URL param string. This is set by the bookmarklet code
	statement.object.id = window.location.toString().substr(window.location.toString().indexOf('#')+1);
	definition.type = "Link";
	
	//Get the cache, then blank it. 
	//Each object in the cache will re-cache if it fails to send, so it's important that the cache be blanked
	//before sending requests - otherwise they will end up on the queue twice
	var cache = getCache();
	localStorage['BookmarkletCache']	= JSON.stringify([]);	
	
	//for every statement in the cache, send it
	for(var i =0; i < cache.length; i++)
	{
		console.log('sending cached statement ' + i);
		//Sent the cached statement with a special callback, one which will recache if the sending fails. Bind the function to an object
		//that contains the current statement as a property, so that the callback has access to the statement the XHR tried to send. 
		//This is because the param to the callback is the XHR object, from which it's harder to access the statement
		TCDriver_SendStatement(tc_lrs, cache[i], function(e){
			if(e.status != '204')
			{
				document.getElementById('statusText').innerHTML = "Cached";
				CacheStatement(this.statement);
			}
		}.bind({statement:statement}));
	}
		
	//After sending all the cached statements, send the current one. Bind the callback to a new object with the statement as a parameter,
	//so the callback can access the statement
	TCDriver_SendStatement(tc_lrs, statement, callback.bind({statement:statement}));
}
///////////////////////////////////////////////////////
//create the GUI element to show the sending message
//////////////////////////////////////////////////////
function ShowProgress(){
		//Don't bother if the GUI already exists in the DOM
		if(!document.getElementById('TinCanBookmarklet'))
		{
			var div = document.createElement('div');
			document.body.appendChild(div);
			div.id = 'TinCanBookmarklet';
			div.className = 'window';
			var text = document.createElement('div');
			text.id = "statusText";
			text.innerHTML="sending...";
			text.style.margin = '10px';
			div.appendChild(text);
		}
}
///////////////////////////////////////////////////////////
//Show the prompt for the user to enter the connection data
///////////////////////////////////////////////////////////
function ShowPrompt()
{
		//don't show it if it already for some reason exists
		if(!document.getElementById('TinCanBookmarklet'))
		{
			var div = document.createElement('div');
			document.body.appendChild(div);
			
			div.id = 'TinCanBookmarklet';
			div.className = "bigwindow";
			var text = document.createElement('div');
			var inputstyle = " class='input' ";
			var buttonstyle = " class='button' ";
			//Create all the input boxes
			text.innerHTML = "It looks like this is the first time you've used this bookmarklet on this computer. Please setup the LRS connection." +
							"<br/>" +
							"<input "+inputstyle+" type='text' id='LRSActorName' /> Your Name <br/>"+
							"<input "+inputstyle+"type='text' id='LRSActorEmail' /> Your Email Address <br/>"+
							"<input "+inputstyle+"type='text' id='LRSAppId' /> LRS Application ID <br/>"+
							"<input "+inputstyle+"type='text' id='LRSAppSecretKey'/> LRS Application Key <br/>"+
							"<button "+buttonstyle+" id='lrssavedata'>Save Settings</button> "+
							"<button "+buttonstyle+" id='lrscancel'>Cancel</button>";
			text.style.margin = '10px';
			div.appendChild(text);
			
			//Bind the onclick events
			document.getElementById('lrscancel').onclick = function(){
				//Sending this message to the parent window will cause the bookmarklet code to remove the iframe that contains the bookmarklet 
				parent.postMessage('closeTinCanBookmarklet',"*");
				document.getElementById('TinCanBookmarklet').parentElement.removeChild(document.getElementById('TinCanBookmarklet')); 
				window.close();
				};
				
			document.getElementById('lrssavedata').onclick = function(){
				//Set the local storage to contain all the data the user entered
				window.localStorage['gActorEmail'] = document.getElementById('LRSActorEmail').value;
				window.localStorage['gActorName'] = document.getElementById('LRSActorName').value;
				window.localStorage['gLRSAppId'] = document.getElementById('LRSAppId').value;
				window.localStorage['gLRSAppSecretKey'] = document.getElementById('LRSAppSecretKey').value;
				//Set the global data to contain the same infor
				gActorEmail = window.localStorage['gActorEmail'];
				gActorName = window.localStorage['gActorName'];
				gLRSAppId = window.localStorage['gLRSAppId'];
				gLRSAppSecretKey = window.localStorage['gLRSAppSecretKey'];
				//Send the statement, using the proper callback
				SendStatement(DialogShowingCallback);
			};
		}
		
}
////////////////////////////////////////////////////////////////////////////
//Get the LRS connection Data. If the data is not available
//show the user a prompt to enter the data
////////////////////////////////////////////////////////////////////////////
function GetLRSConnectionData()
{
	//If the data is in the localstorage, and the url to store is not the string 'reset', then get the data and return true
	if(localStorage['gActorEmail'] && localStorage['gActorEmail'] != "" && window.location.toString().substr(window.location.toString().indexOf('#')+1) != 'reset')
	{
		gActorEmail = localStorage['gActorEmail'];
		gActorName = localStorage['gActorName'];
		gLRSAppId = localStorage['gLRSAppId'];
		gLRSAppSecretKey = localStorage['gLRSAppSecretKey'];
		//Show the progress prompt
		ShowProgress();
		return true;
	}
	//If the command is 'reset', blank the data and show an alert
	else if(window.location.toString().substr(window.location.toString().indexOf('#')+1) == 'reset')
	{
		window.localStorage['gActorEmail'] = "";
		window.localStorage['gActorName'] = "";
		window.localStorage['gLRSAppId'] = "";
		window.localStorage['gLRSAppSecretKey'] = "";
	    alert('Data Cleared');
		//ask the bookmarklet to close itself in 300 ms
		window.setTimeout(function(){parent.postMessage('closeTinCanBookmarklet',"*")},300);
		return false;
	}
	//The data is missing, so show the prompt and return false
	else
	{
		window.localStorage['gActorEmail'] = "";
		window.localStorage['gActorName'] = "";
		window.localStorage['gLRSAppId'] = "";
		window.localStorage['gLRSAppSecretKey'] = "";
	    ShowPrompt();
		return false;
	}
}

///////////////////////////////////////////////////////////////////////////////
//callback for the sending function when the data entry dialog is showing
//this will not close the dialog, so that if there is an error, the user can
//enter new values and try again
//////////////////////////////////////////////////////////////////////////////
function DialogShowingCallback(e)
{
	//If the status is good, store the global values
	if(e.status == '204')
	{
		//the current setting must be good, store them
		localStorage['gActorEmail'] = gActorEmail;
		localStorage['gActorName'] = gActorName;
		localStorage['gLRSAppId'] = gLRSAppId;
		localStorage['gLRSAppSecretKey'] = gLRSAppSecretKey;
		//Ask the bookmarklet code to remove the iframe
		document.getElementById('TinCanBookmarklet').parentElement.removeChild(document.getElementById('TinCanBookmarklet'));
		parent.postMessage('closeTinCanBookmarklet',"*");
		alert('Link sent to LRS');
	}
	//There was some sort of connection problem. This will only occur if there is no connection when using the bookmarklet for the first time
	else if(e.status < '400')
	{
			alert("statement cached until connection is restored");
			CacheStatement(this.statement);
			document.getElementById('TinCanBookmarklet').parentElement.removeChild(document.getElementById('TinCanBookmarklet'));
	}
	//There is some sort of error, possibly a bad value. PRompt the user, but leave the dialog up so they can try again
	else
	{
		alert(e.responseText);
	}
}
////////////////////////////////////////////////////////////////
//main bootstrap for the bookmarklet
//Try to get the connction data. If you get it, send the statement. Otherwise, the GetConnectionData function will show the 
//Data entry function
///////////////////////////////////////////////////////////////
function LRSGO(){
if(GetLRSConnectionData()) SendStatement(SuccessCallback);
}

//onload, fire the bootstrap
window.onload=function(){
LRSGO();
};


//*********************************************************************************************************
//code below is from the Rustici TCDriver file
function delay() {
    var xhr = new XMLHttpRequest();
    var url = window.location + '?forcenocache='+_ruuid();
    xhr.open('GET', url, false);
    xhr.send(null);
}

function XHR_request(lrs, url, method, data, auth, callback, ignore404, extraHeaders) {
    "use strict";
    var xhr,
        finished = false,
        xDomainRequest = false,
        ieXDomain = false,
        ieModeRequest,
        title,
        ticks = ['/','-','\\','|'],
        urlparts = url.toLowerCase().match(/^(.+):\/\/([^:\/]*):?(\d+)?(\/.*)?$/),
        location = window.location,
        urlPort,
        result,
        extended,
        prop,
        until;


	if (lrs !== null && lrs.extended !== undefined) {
		extended = new Array();
		for (prop in lrs.extended) {
			extended.push(prop + "=" + encodeURIComponent(lrs.extended[prop]));
		}
		if (extended.length > 0) {
			url += (url.indexOf("?") > -1 ? "&" : "?") + extended.join("&");
		}
	}
     

    var headers = {};
    headers["Content-Type"] = "application/json";
    headers["Authorization"] = auth;
    if(extraHeaders !== null){
        for(var headerName in extraHeaders){
            headers[headerName] = extraHeaders[headerName];
        }
    }
    

    xDomainRequest = (location.protocol.toLowerCase() !== urlparts[1] || location.hostname.toLowerCase() !== urlparts[2]);
    if (!xDomainRequest) {
        urlPort = (urlparts[3] === null ? ( urlparts[1] === 'http' ? '80' : '443') : urlparts[3]);
        xDomainRequest = (urlPort === location.port);
    }
    

    if (!xDomainRequest || typeof(XDomainRequest) === 'undefined') {
        xhr = new XMLHttpRequest();
        xhr.open(method, url, callback != null);
        for(var headerName in headers){
            xhr.setRequestHeader(headerName, headers[headerName]);
        }
    } 

    else {
        ieXDomain = true;
        ieModeRequest = TCDriver_GetIEModeRequest(method, url, headers, data);
        xhr = new XDomainRequest();
        console.log(ieModeRequest.method + ", " + ieModeRequest.url);
        xhr.open(ieModeRequest.method, ieModeRequest.url);
    }
    
    
    function requestComplete() {
        if(!finished){
           
            finished = true;
            var notFoundOk = (ignore404 && xhr.status === 404);
            if (xhr.status === undefined || (xhr.status >= 200 && xhr.status < 400) || notFoundOk) {
                if (callback) {
                    callback(xhr);
                } else {
                    result = xhr;
                    return xhr;
                }
            } else {
				console.log("There was a problem communicating with the Learning Record Store. (" + xhr.status + " | " + xhr.responseText+ ")");
                if (callback) {
                    callback(xhr);
                } 
                return xhr;
            }
        } else {
            return result;
        }
    };

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            requestComplete();
        }
    };

    xhr.onload = requestComplete;
    xhr.onerror = requestComplete;

    xhr.send(ieXDomain ? ieModeRequest.data : data);
    
    if (!callback) {
       
        if (ieXDomain) {
           
            until = 1000 + new Date();
            while (new Date() < until && xhr.readyState !== 4 && !finished) {
                delay();
            }
        }
        return requestComplete();
    }
}


function TCDriver_Log(str){
    if(console !== undefined){
        console.log(str);
    }
}

function TCDriver_GetIEModeRequest(method, url, headers, data){
	var newUrl = url;
	
	
    var formData = new Array();
    var qsIndex = newUrl.indexOf('?');
    if(qsIndex > 0){
        formData.push(newUrl.substr(qsIndex+1));
        newUrl = newUrl.substr(0, qsIndex);
    }

   
    newUrl = newUrl + '?method=' + method;
    
    
    if(headers !== null){
        for(var headerName in headers){
            formData.push(headerName + "=" + encodeURIComponent(headers[headerName]));
        }
    }

   
    if(data !== null){
        formData.push('content=' + encodeURIComponent(data));
    }
    
    return {
    	"method":"POST",
    	"url":newUrl,
    	"headers":{},
    	"data":formData.join("&")
    };
};


function TCDriver_GetLRSObject(){
    var lrsProps = ["endpoint","auth","actor","registration","activity_id", "grouping", "activity_platform"];
    var lrs = new Object();
    var qsVars, prop;

    
    lrs.endpoint = "https://cloud.scorm.com/ScormEngineInterface/TCAPI/"+gLRSAppId+"/sandbox/";
    lrs.auth = "Basic " + window.btoa(gLRSAppId +':' + gLRSAppSecretKey);
    lrs.actor = { mbox: ["mailto:" + gActorEmail], name: [gActorName] };
    
	
    if(lrs.endpoint === undefined || lrs.endpoint == "" || lrs.auth === undefined || lrs.auth == ""){
        TCDriver_Log("Configuring TCDriver LRS Object from queryString failed");
        return null;
    }
    
   
    
    return lrs;
}

function _TCDriver_PrepareStatement(lrs, stmt) {
	if(stmt.actor === undefined){
		stmt.actor = JSON.parse(lrs.actor);
	}
	if (lrs.grouping | lrs.registration | lrs.activity_platform) {
		if (!stmt.context) {
			stmt.context = {};
		}
	}
	
	if (lrs.grouping) {
		if (!stmt.context.contextActivities) {
			stmt.context.contextActivities = {};
		}
		stmt.context.contextActivities.grouping = { id : lrs.grouping };
	}
	if (lrs.registration) {
		stmt.context.registration = lrs.registration;
	}
	if (lrs.activity_platform) {
		stmt.context.platform = lrs.activity_platform;
	}
}



function TCDriver_SendStatement (lrs, stmt, callback) {
    if (lrs.endpoint != undefined && lrs.endpoint != "" && lrs.auth != undefined && lrs.auth != ""){
		_TCDriver_PrepareStatement(lrs, stmt);
        XHR_request(lrs, lrs.endpoint+"statements/?statementId="+_ruuid(), "PUT", JSON.stringify(stmt), lrs.auth, callback);
    }
}


function parseQueryString() {
	var loc, qs, pairs, pair, ii, parsed = {};
	
	loc = window.location.href.split('?');
	if (loc.length === 2) {
		qs = loc[1];
		pairs = qs.split('&');
		for ( ii = 0; ii < pairs.length; ii++) {
			pair = pairs[ii].split('=');
			if (pair.length === 2 && pair[0]) {
				parsed[pair[0]] = decodeURIComponent(pair[1]);
			}
		}
	}
	
	return parsed;
}

function _ruuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
        });
 }

