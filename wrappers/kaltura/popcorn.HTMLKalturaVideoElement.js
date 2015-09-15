// these need to be overwritten
var kdp;

(function( Popcorn, window, document ) {

  var

  EMPTY_STRING = "",
  kalturaReady = false,
  kalturaLoaded = false,
  kalturaCallbacks = [];

  function onKalturaAPIReady() {
    kalturaReady = true;
    var i = kalturaCallbacks.length;
    while( i-- ) {
      kalturaCallbacks[ i ]();
      delete kalturaCallbacks[ i ];
    }
  };

  function kalturaPlayerReadyCheck(W) {
    if ( window.kWidget ) {
      onKalturaAPIReady();
    } else {
      setTimeout( kalturaPlayerReadyCheck, 100 );
    }
  }

  function iskalturaPlayerReady() {
    // If the kalturaPlayer API isn't injected, do it now.
    if ( !kalturaLoaded ) {
      if ( !window.kalturaPlayer ) {
        var tag = document.createElement( "script" );
        var protocol = window.location.protocol === "file:" ? "http:" : "";

        try {
          kalturaPartnerId
        }catch(e){
        //if ( kalturaPartnerId === undefined || kalturaPartnerId == -1 || kalturaPartnerId == "" || kalturaUiConfigId == -1 || kalturaUiConfigId == "") {
          alert("Kaltura was not configured correctly, missing Partner Id or Kaltura UI config ID\nYou can fix this under your account settings")
          return false;
        }

        tag.src = protocol + "//cdnapi.kaltura.com/p/"+kalturaPartnerId+"/sp/"+kalturaPartnerId+"00/embedIframeJs/uiconf_id/"+kalturaUiConfigId+"/partner_id/" + kalturaPartnerId;
        var firstScriptTag = document.getElementsByTagName( "script" )[ 0 ];
        firstScriptTag.parentNode.insertBefore( tag, firstScriptTag );
      }
      kalturaLoaded = true;
      kalturaPlayerReadyCheck();
    }
    return kalturaReady;
  }

  function addkalturaPlayerCallback( callback ) {
    kalturaCallbacks.unshift( callback );
  }

  function HTMLKalturaVideoElement( id, _options ) {

    if ( !window.postMessage ) {
      throw "ERROR: HTMLKalturaVideoElement requires window.postMessage";
    }

    var self = new Popcorn._MediaElementProto(),
      parent = typeof id === "string" ? document.querySelector( id ) : id,
      impl = {
        src: EMPTY_STRING,
        networkState: self.NETWORK_EMPTY,
        readyState: self.HAVE_NOTHING,
        seeking: false,
        autoplay: EMPTY_STRING,
        preload: EMPTY_STRING,
        controls: false,
        loop: false,
        poster: EMPTY_STRING,
        volume: 1,
        muted: false,
        currentTime: 0,
        duration: NaN,
        ended: false,
        paused: true,
        error: null
      },
      playerReady = false,
      catchRoguePauseEvent = false,
      catchRoguePlayEvent = false,
      mediaReady = false,
      loopedPlay = false,
      player,
      playerPaused = true,
      mediaReadyCallbacks = [],
      playerState = -1,
      lastLoadedFraction = 0,
      firstPlay = true,
      firstPause = false;

    // set (Kaltura) options
    self.options = {
      streamerType: "http", // http / rtmp / live / hdnetwork / auto, http://player.kaltura.com/docs/index.php?path=api#streamerType
      kalturaUiConfigId, "your kalturaUiConfigId"
      kalturaPartnerId, "your kalturaPartnerId"
      controlBarContainer: true,
      largePlayBtn: true,
      loadingSpinner: true
    }

    // override (Kaltura) options
    if ( _options !== undefined) {
      if ( _options.streamerType !== null ) self.options.streamerType = _options.streamerType
      if ( _options.controlBarContainer !== null ) self.options.controlBarContainer = _options.controlBarContainer
      if ( _options.largePlayBtn !== null ) self.options.largePlayBtn = _options.largePlayBtn
      if ( _options.loadingSpinner !== null ) self.options.loadingSpinner = _options.loadingSpinner
    }

    // Namespace all events we'll produce
    self._eventNamespace = Popcorn.guid( "HTMLKalturaVideoElement::" );

    self.parentNode = parent;

    // Mark this as kalturaPlayer
    self._util.type = "kalturaPlayer";

    function addMediaReadyCallback( callback ) {
      mediaReadyCallbacks.unshift( callback );
    }

    function onReady() {
      // kalturaPlayer needs a play/pause to force ready state.
      // However, the ready state does not happen until after the play/pause callbacks.
      // So we put this inside a setTimeout to ensure we do this afterwards,
      // thus, actually being ready.
      setTimeout( function() {
        impl.duration = player.evaluate('{duration}')
        self.dispatchEvent( "durationchange" );
        impl.readyState = self.HAVE_METADATA;
        self.dispatchEvent( "loadedmetadata" );
        self.dispatchEvent( "loadeddata" );

        impl.readyState = self.HAVE_FUTURE_DATA;
        self.dispatchEvent( "canplay" );

        mediaReady = true;

        var i = 0;
        while( mediaReadyCallbacks.length ) {
          mediaReadyCallbacks[ i ]();
          mediaReadyCallbacks.shift();
        }
        // We can't easily determine canplaythrough, but will send anyway.
        impl.readyState = self.HAVE_ENOUGH_DATA;
        self.dispatchEvent( "canplaythrough" );
      }, 0 );
    }

    // TODO: (maybe)
    // kalturaPlayer events cannot be removed, so we use functions inside the event.
    // This way we can change these functions to "remove" events.
    function onPauseEvent() {
      if ( catchRoguePauseEvent ) {
        catchRoguePauseEvent = false;
      } else if ( firstPause ) {
        firstPause = false;
        onReady();
      } else {
        onPause();
      }
    }
    function onPlayEvent() {
      console.log("KALTURA onPlayEvent", firstPlay)

      if ( firstPlay ) {
        // fake ready event
        firstPlay = false;
        addMediaReadyCallback( onPlay );
        onReady();
        isPlaying = true

      //  // Set initial paused state
      //  if ( impl.autoplay || !impl.paused ) {
      //    impl.paused = false;
      //    addMediaReadyCallback( onPlay );
      //    onReady();
      //  } else {
      //    firstPause = true;
      //    catchRoguePlayEvent = true;
      //    //player.pause( true );
      //    player.sendNotification('doPause')
      //  }

      //} else if ( catchRoguePlayEvent ) {
      //  catchRoguePlayEvent = false;
      //  catchRoguePauseEvent = true;
      //  // Repause without triggering any events.
      //  // player.pause( true );
      //  player.sendNotification('doPause')

      } else {
        onPlay();
      }
    }

    function onSeekEvent() {
      if ( impl.seeking ) {
        onSeeked();
      }
    }

    function onPlayerReady() {

      try {
        player.addJsListener('doPause',  onPauseEvent );
      }catch(e){
        console.log("PLAYER WAS NOT READY")
        setTimeout( function() { onPlayerReady()}, 500)
        return
      }

      player.addJsListener('playerUpdatePlayhead', function() {
        if ( !impl.ended && !impl.seeking ) {
          impl.currentTime = player.evaluate('{video.player.currentTime}')
          self.dispatchEvent( "timeupdate" );
        }
      });
      player.addJsListener( 'playerSeekStart', onSeekEvent );
      player.addJsListener('doPlay', function() {
        if ( !impl.ended ) {
          onPlayEvent();
        }
      });

      player.addJsListener( 'bytesDownloadedChange', onProgress );
      player.addJsListener( 'bufferProgress', onProgress );
      player.addJsListener( 'playerPlayEnd', onEnded );

      /*
      	var kdp = $('#' + playerId )[0];
      	}
      	kdp.kBind( 'bytesDownloadedChange', function( eventData ){
      		$('#bufferEvents').append(
      			'testBytesDownloadedChange: ' + eventData.newValue
      		)
      	});
      	kdp.kBind( 'bufferProgress',  function( eventData ){
      		$('#bufferEvents').append(
      			'bufferProgress: new time: ' + eventData.newTime
      		)
      	});
    	*/

      // needs to enable player, could build a youtube like firstplay ?
      // player.sendNotification('doPlay');
      // setTimeout( function() { player.sendNotification('doPause'); }, 300 )
    }

    function getDuration() {
      //if (player == null || player == undefined) return -1
      //return player.evaluate('{duration}')
      try { return player.evaluate('{duration}') } catch(e) { return -1; }
    }

    function onPlayerError( e ) {
      var err = { name: "MediaError" };
      err.message = e.message;
      err.code = e.code || 5;

      impl.error = err;
      self.dispatchEvent( "error" );
    }

    function destroyPlayer() {
      player.destroy();
      kWidget.destroy();
      if ( !( playerReady && player ) ) {
        return;
      }
    }

    function changeSrc( aSrc ) {
      if ( !self._canPlaySrc( aSrc ) ) {
        impl.error = {
          name: "MediaError",
          message: "Media Source Not Supported",
          code: MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
        };
        self.dispatchEvent( "error" );
        return;
      }

      // Use any player vars passed on the URL
      var playerVars = self._util.parseUri( aSrc ).queryKey;

      // Show/hide controls. Sync with impl.controls and prefer URL value.
      impl.controls = playerVars.controls = playerVars.controls || impl.controls;

      impl.src = aSrc;

      // Make sure kalturaPlayer is ready, and if not, register a callback
      if ( !iskalturaPlayerReady() ) {
        addkalturaPlayerCallback( function() { changeSrc( aSrc ); } );
        return;
      }

      if ( playerReady ) {
        destroyPlayer();
      }

      // failsafe
      // these need to be overwritten

      // should fix things but errors:
      // now is auto
      //self.options.streamerType = "http"

      kWidget.embed({
        "targetId": "video_frame",
        "wid": "_" + self.options.kalturaPartnerId,
        "uiconf_id": self.options.kalturaUiConfigId,
        "flashvars": {
          'vast': {
            'preSequence': 0
          },
          'streamerType': self.options.streamerType,
          'externalInterfaceDisabled': false,
          //'controlBarContainer.plugin': self.options.controlBarContainer,
	        'largePlayBtn.plugin': self.options.largePlayBtn,
	        //'loadingSpinner.plugin': self.options.loadingSpinner

          'controlBarContainer.plugin': false,
        	//'largePlayBtn.plugin': false,
        	'loadingSpinner.plugin': true
	        //"IframeCustomPluginCss1" : 'customSkin.css',
        },
        "cache_st": 0, //1426695728,  rand number ?
        "entry_id": aSrc
      });

      player = document.getElementById( parent.id );
      kWidget.addReadyCallback( onPlayerReady )
      // player.onerror( onPlayerError );
      // kalturaPlayer.utils.log = function( msg, obj ) {
      //  if ( typeof console !== "undefined" && typeof console.log !== "undefined" ) {
      //    if ( obj ) {
      //      console.log( msg, obj );
      //    } else {
      //      console.log( msg );
      //    }
      //  }

      //  if ( msg === "No suitable players found and fallback enabled" ) {
      //    onPlayerError({
      //      message: msg,
      //      code: 4
      //    });
      //  }
      //};

      impl.networkState = self.NETWORK_LOADING;
      self.dispatchEvent( "loadstart" );
      self.dispatchEvent( "progress" );
    }

    function getCurrentTime() {
      return impl.currentTime;
    }

    function changeCurrentTime( aTime ) {
      impl.currentTime = aTime;
      if ( !mediaReady ) {
        addMediaReadyCallback( function() {
          onSeeking();
          player.sendNotification("doSeek", aTime );
        });
        return;
      }

      onSeeking();
      player.sendNotification("doSeek", aTime );
    }

    function onSeeking() {
      impl.seeking = true;
      // kalturaPlayer plays right after a seek, we do not want this.
      if ( impl.paused ) {
        catchRoguePlayEvent = true;
      }
      self.dispatchEvent( "seeking" );
    }

    function onSeeked() {
      impl.ended = false;
      impl.seeking = false;
      self.dispatchEvent( "timeupdate" );
      self.dispatchEvent( "seeked" );
      self.dispatchEvent( "canplay" );
      self.dispatchEvent( "canplaythrough" );
    }

    function onPlay() {
      impl.paused = false;

      if ( playerPaused ) {
        playerPaused = false;

        // Only 1 play when video.loop=true
        if ( ( impl.loop && !loopedPlay ) || !impl.loop ) {
          loopedPlay = true;
          self.dispatchEvent( "play" );
        }
        self.dispatchEvent( "playing" );
      }
    }

    function onProgress() {
      if ( agent.label != "IE8") self.dispatchEvent( "progress" );
    }

    self.play = function() {
      self.dispatchEvent( "play" );
      impl.paused = false;
      if ( !mediaReady ) {
        addMediaReadyCallback( function() { self.play(); } );
        return;
      }
      if ( impl.ended ) {
        changeCurrentTime( 0 );
        impl.ended = false;
      }
      //player.play( true );
      player.sendNotification('doPlay')
    };

    function onPause() {
      impl.paused = true;
      if ( !playerPaused ) {
        playerPaused = true;
        self.dispatchEvent( "pause" );
      }
    }

    self.pause = function() {
      impl.paused = true;
      if ( !mediaReady ) {
        addMediaReadyCallback( function() { self.pause(); } );
        return;
      }
      //player.pause( true );
      player.sendNotification('doPause')
    };

    function onEnded() {
      if ( impl.loop ) {
        changeCurrentTime( 0 );
      } else {
        impl.ended = true;
        onPause();
        self.dispatchEvent( "timeupdate" );
        self.dispatchEvent( "ended" );
      }
    }

    function setVolume( aValue ) {
      impl.volume = aValue;
      if ( !mediaReady ) {
        addMediaReadyCallback( function() {
          player.sendNotification("changeVolume", impl.volume);
        });
        return;
      }
      player.sendNotification("changeVolume", impl.volume); // * 100 ?
      self.dispatchEvent( "volumechange" );
    }

    function setMuted( aValue ) {
      impl.muted = aValue;
      if ( !mediaReady ) {
        addMediaReadyCallback( function() { setMuted( impl.muted ); } );
        return;
      }

      if ( !impl.muted ) {
        player.sendNotification("changeVolume", impl.volume );
      }else{
        player.sendNotification("changeVolume", 0);
      }

      self.dispatchEvent( "volumechange" );
    }

    function getMuted() {
      return impl.muted;
    }

    Object.defineProperties( self, {

      src: {
        get: function() {
          return impl.src;
        },
        set: function( aSrc ) {
          if ( aSrc && aSrc !== impl.src ) {
            changeSrc( aSrc );
          }
        }
      },

      autoplay: {
        get: function() {
          return impl.autoplay;
        },
        set: function( aValue ) {
          impl.autoplay = self._util.isAttributeSet( aValue );
        }
      },

      loop: {
        get: function() {
          return impl.loop;
        },
        set: function( aValue ) {
          impl.loop = self._util.isAttributeSet( aValue );
        }
      },

      width: {
        get: function() {
          return self.parentNode.offsetWidth;
        }
      },

      height: {
        get: function() {
          return self.parentNode.offsetHeight;
        }
      },

      currentTime: {
        get: function() {
          return getCurrentTime();
        },
        set: function( aValue ) {
          changeCurrentTime( aValue );
        }
      },

      duration: {
        get: function() {
          return getDuration();
        }
      },

      ended: {
        get: function() {
          return impl.ended;
        }
      },

      paused: {
        get: function() {
          return impl.paused;
        }
      },

      seeking: {
        get: function() {
          return impl.seeking;
        }
      },

      readyState: {
        get: function() {
          return impl.readyState;
        }
      },

      networkState: {
        get: function() {
          return impl.networkState;
        }
      },

      volume: {
        get: function() {
          return impl.volume;
        },
        set: function( aValue ) {
          if ( aValue < 0 || aValue > 1 ) {
            throw "Volume value must be between 0.0 and 1.0";
          }

          setVolume( aValue );
        }
      },

      muted: {
        get: function() {
          return impl.muted;
        },
        set: function( aValue ) {
          setMuted( self._util.isAttributeSet( aValue ) );
        }
      },

      error: {
        get: function() {
          return impl.error;
        }
      },

      buffered: {
        get: function () {
          var timeRanges = {
            start: function( index ) {
              if ( index === 0 ) {
                return 0;
              }

              //throw fake DOMException/INDEX_SIZE_ERR
              throw "INDEX_SIZE_ERR: DOM Exception 1";
            },
            end: function( index ) {
              var duration;
              if ( index === 0 ) {
                duration = getDuration();
                if ( !duration ) {
                  return 0;
                }

                //return duration * ( player.getBuffer() / 100 );
                return 0.5
              }

              //throw fake DOMException/INDEX_SIZE_ERR
              throw "INDEX_SIZE_ERR: DOM Exception 1";
            }
          };

          Object.defineProperties( timeRanges, {
            length: {
              get: function() {
                return 1;
              }
            }
          });

          return timeRanges;
        }
      }
    });

    self._canPlaySrc = Popcorn.HTMLKalturaVideoElement._canPlaySrc;
    self.canPlayType = Popcorn.HTMLKalturaVideoElement.canPlayType;

    return self;
  }

  Popcorn.HTMLKalturaVideoElement = function( id, options ) {
    return new HTMLKalturaVideoElement( id, options );
  };

  // Helper for identifying URLs we know how to play.
  Popcorn.HTMLKalturaVideoElement._canPlaySrc = function( url ) {
    // Because of the nature of kalturaPlayer playing all media types,
    // it can potentially play all url formats.
    return "probably";
  };

  // This could potentially support everything. It is a bit of a catch all player.
  Popcorn.HTMLKalturaVideoElement.canPlayType = function( type ) {
    return "probably";
  };

}( Popcorn, window, document ));
