const isString = require( "lodash.isstring" );
const isFunction = require( "lodash.isfunction" );
const autobahn = require( "autobahn" );

/**
 *  @typedef  RPC
 *  @type     {Object}
 *  @property {string}    name  The name of the RPC.
 *  @property {function}  func  The function to execute.
 */

/**
 *  @typedef  options
 *  @type     {Object}
 *  @property {Object}  connect             See {@link https://github.com/crossbario/autobahn-js/blob/master/doc/reference.md#connection-options|connection options}
 *  @property {string}  [connect.url="ws://localhost:8080/ws"]  Crossbar "url" to connect to.
 *  @property {string}  [connect.realm="realm1"]                Crossbar "realm" for the "url".
 *  @property {Object}  [publish={}]        See {@link https://github.com/crossbario/autobahn-js/blob/master/doc/reference.md#publish|publish options}
 *  @property {Object}  [subscribe={}]      See {@link https://github.com/crossbario/autobahn-js/blob/master/doc/reference.md#subscribe|subscribe options}
 *  @property {Object}  [call={}]           See {@link https://github.com/crossbario/autobahn-js/blob/master/doc/reference.md#call|call options}
 *  @property {Object}  [register={}]       See {@link https://github.com/crossbario/autobahn-js/blob/master/doc/reference.md#register|register options}
 */

/**
 *  @public
 *  @author   Pedro Miguel P. S. Martins
 *  @version  1.2.0
 *  @module   crossbarjs
 *  @desc
 *  Encapsulates crossbar publish/subscribe and register/unregister/call functionality into a facade, easier to use and reason about.
 */
const crossbarFactory = () => {

    const DEFAULT_OPTS = Object.freeze( {
        connect: {
            "url": "ws://localhost:8080/ws",
            "realm": "realm1"
        },
        publish: {},
        subscribe: {},
        call: {},
        register: {}
    } );

    const subscritionMap = new Map(),
        registrationMap = new Map();

    let connection,
        options = Object.assign( {}, DEFAULT_OPTS );

    /**
     *  @public
     *  @function connect
     *  @param    {Object=}  [connectOpts]  Connection object with the
     *                                      options to connect.
     *                                      The provided Object must have both
     *                                      an <code>url</code> and a
     *                                      <code>realm</code> properties to
     *                                      properly connect or else it fails.
     *                                      If no  object is passed, the
     *                                      function will use the default object.
     *  @param    {string}  [connectOpts.url = "ws://localhost:8080/ws"]  The connection 'url' as described in autobahn connection options.
     *  @param    {string}  [connectOpts.realm = "realm1"]                The connection 'realm' as described in autobahn connection options.
     *  @returns  {Promise}
     *
     *  @description
     *  Connects this instance to the given direction.
     *  Resolves if a connection is established **and** opened successfully.
     *  If it fails to open the connection, it rejects with a reason and an optional  details object.
     *
     *  @see          {@link https://github.com/crossbario/autobahn-js/blob/master/doc/reference.md#connection-options|autobahn-js connection options}
     *
     *  @example  <caption>Creates a connection with the default parameters:</caption>
     *  const crossbarjs = require("crossbarjs");
     *
     *  const crossbar  = crossbarjs();
     *  crossbar.connect()
     *    .then(() => console.log("Great Success!"))
     *    .catch((reason, details) => {
     *        console.log(`Failed becasue ${reason}: ${JSON.stringify(details)}`);
     *    });
     *
     *  @example  <caption>Creates a connections with custom parameters:</caption>
     *  const crossbarjs = require("crossbarjs");
     *
     *  const crossbar  = crossbarjs();
     *  const connectParams = {url: "myURL", realm: "Lovecraft"};
     *  crossbar.connect(connectParams)
     *    .then(() => console.log("Great Success!"))
     *    .catch((reason, details) => {
     *        console.log(`Failed becasue ${reason}: ${JSON.stringify(details)}`);
     *    });
     *
     *  @example  <caption>Additionally, you may also change the "options.connect":</caption>
     *  const crossbarjs = require("crossbarjs");
     *
     *  const crossbar  = crossbarjs();
     *
     *  crossbar.setOpts({
     *    connect: { url: "myURL", realm: "Lovecraft" }
     *  });
     *
     *  crossbar.connect()
     *    .then(() => console.log("Great Success!"))
     *    .catch((reason, details) => {
     *        console.log(`Failed becasue ${reason}: ${JSON.stringify(details)}`);
     *    });
     */
    const connect = function ( connectOpts = options.connect ) {
        return new Promise( ( resolve, reject ) => {
            connection = new autobahn.Connection( connectOpts );
            connection.onopen = () => {
                events.onOpen();
                resolve();

                connection.onopen = () => {
                    events.onOpen();
                    recover()
                        .then( events.onRecover )
                        .catch( events.onError );
                };
            };

            connection.onclose = ( reason, details ) => {
                events.onClose( reason, details );
                reject( reason, details );
                connection.onclose = events.onClose;
            };
            connection.open();
        } );
    };

    /**
     * @private
     * @function  recover
     *
     * @description
     * This is responsible for the recovery proccess. Every time a connection is recovered, this function will re-subscribe and re-register everything to the functionality of the service is not interrupted.
     */
    const recover = () =>
        recoverFromMap( "subscribe", subscritionMap )
            .then( () => recoverFromMap( "register", registrationMap ) );

    const recoverFromMap = async function ( action, map ) {
        for ( const [ key, data ] of map ) {
            await add(
                action,
                key,
                data.cb,
                options[ action ], { set: () => {} }
            ).catch( err => events.onError( err ) );
        }
    };

    const events = {
        onClose: () => {},
        onOpen: () => {},
        onRecover: () => {},
        onError: () => {}
    };

    /**
     * @public
     * @function  onClose
     * @param     {function}   fun   The function to be called when a connection closes.
     * @throws    {TypeError} If <code>fun</code> is not a function.
     *
     * @description
     * Hook for when the connection closes. This usually happens when crossbar itself dies or closes its connections.
     * The passed function will receive 2 parameters, <code>reason</code>, a human readable reason for why the connection was closed, and a second optional parameter <code>details</code>, an object containing the details of why the connection was closed. This second parameter is not always passed.
     *
     * @example <caption>Creating a hook that logs when a connection was closed:</caption>
     * const crossbarjs = require("crossbarjs");
     *
     * const crossbar  = crossbarjs();
     * crossbar.connect()
     *    .then(() => crossbar.onClose(console.log))  //if crossbar dies, this gets fired
     *    .catch((reason, details) => {
     *        console.log(`Failed becasue ${reason}: ${JSON.stringify(details)}`);
     * });
     */
    const onClose = fun => {
        if ( !isFunction( fun ) )
            throw new TypeError( `${fun} must be a Function.` );
        events.onClose = fun;
    };

    /**
     * @public
     * @function  onOpen
     * @param     {function}   fun   The function to be called when a connection opens.
     * @throws    {TypeError} If <code>fun</code> is not a function.
     *
     * @description
     * Hook for when the connection opens. This usually happens when the application first connects to crossbar and when the connection is lost and later on recovered.
     * The passed function will receive no parameters.
     *
     * @example <caption>Creating a hook that logs when a connection opens:</caption>
     * const crossbarjs = require("crossbarjs");
     *
     * const crossbar  = crossbarjs();
     * crossbar.onOpen(() => console.log("I'm alive!"));
     * crossbar.connect()
     *    .catch((reason, details) => {
     *        console.log(`Failed becasue ${reason}: ${JSON.stringify(details)}`);
     * });
     */
    const onOpen = fun => {
        events.onOpen = fun;
    };

    /**
     * @public
     * @function  onRecover
     * @param     {function}   fun   The function to be called when a connection recovers.
     * @throws    {TypeError} If <code>fun</code> is not a function.
     *
     * @description
     * Hook for when the connection recovers. A connection recovers when it has closed unexpectadly and then reconnects activating the recover proceaduer, that re-subscribes and re-registers any calls previously done automatically.
     * The passed function will receive no parameters.
     *
     * @example <caption>Creating a hook that logs when a connection recovers:</caption>
     * const crossbarjs = require("crossbarjs");
     *
     * const crossbar  = crossbarjs();
     * crossbar.onRecover(() => console.log("I'm back baby!"));
     * crossbar.connect()
     *    .catch((reason, details) => {
     *        console.log(`Failed becasue ${reason}: ${JSON.stringify(details)}`);
     * });
     * //kill crossbar
     * //start crossbar
     * //message should appear
     */
    const onRecover = fun => {
        events.onRecover = fun;
    };

    /**
     * @public
     * @function  onError
     * @param     {function}   fun   The function to be called when an Error occurs.
     * @throws    {TypeError} If <code>fun</code> is not a function.
     *
     * @description
     * Hook for when an error occurs. Errors may occur when crossbarjs is attempting automatic reconnection or becasue some other component failed.
     * The passed function will receive the <code>error</code> as a parameter.
     *
     * @example <caption>Creating a hook that logs when an error occurs:</caption>
     * const crossbarjs = require("crossbarjs");
     *
     * const crossbar  = crossbarjs();
     * crossbar.onRecover(error => console.log(`Got error: ${error}`));
     */
    const onError = fun => {
        events.onError = fun;
    };

    /**
     *  @public
     *  @function disconnect
     *  @param    {string}  [reason="wamp.goodbye.normal"]  WAMP URI providing a closing reason e.g. 'com.myapp.close.signout' to the server side.
     *  @param    {string}  [message]                       Human-readable closing message.
     *  @returns {Promise}
     *
     *  @description
     *  Closes the crossbar connection. Resolves once the connection is closed or rejects if there was an error closing.
     *
     *  @example <caption>Simply disconnect:</caption>
     *
     *  //imagine we have previously connected
     *  crossbar.disconnect()
     *    .then(() => console.log("disconnected!"))
     *    .catch(console.log);
     *
     *  @example <caption>Disconnect after connecting:</caption>
     *  const crossbarjs = require("crossbarjs");
     *
     *  const crossbar  = crossbarjs();
     *  crossbar.connect()
     *    .then(() => console.log("connected!"))
     *    .then(() => crossbar.disconnect("com.myapp.close.signout", "client does not like our service !!!!"))
     *    .then(() => console.log("disconnected!"))
     *    .catch(console.log);
     *
     * @example <caption>Error while disconnecting:</caption>
     *  const crossbarjs = require("crossbarjs");
     *
     *  const crossbar  = crossbarjs();
     *  crossbar.disconnect()
     *    .catch(console.log);  //error, we never connected in the first place!
     */
    const disconnect = function ( reason, message ) {
        return new Promise( ( resolve, reject ) => {
            connection.onclose = resolve;
            try {
                connection.close( reason, message );
            } catch ( error ) {
                reject( error );
            }
        } );
    };

    /**
     *  @public
     *  @function getSession
     *  @returns {Session}
     *
     *  @description
     *  Returns the current autobahn.Session object.
     *  Ideally you shouldn't need to use it with the current interface, but in case you need you can have direct access to it.
     *
     *  @see {@link https://github.com/crossbario/autobahn-js/blob/master/doc/reference.md#sessions|autobahn-js sessions}
     *
     *  @example <caption>Using a session:</caption>
     *  //Assuming we have previously connected
     *  const session = crossbar.getSession();
     *  console.log(`Session id is: ${session.id}`);
     */
    const getSession = function () {
        return connection.session;
    };

    /**
     *  @public
     *  @function getConnection
     *  @returns {Connection}
     *
     *  @description  Returns the current autobahn.Connection object.
     *
     *  @see  {@link  https://github.com/crossbario/autobahn-js/blob/master/doc/reference.md#connections|autobahn-js connections}
     *
     *  @example <caption>Using a connection:</caption>
     *  //Assuming we have previously connected
     *  const conn = crossbar.getConnection();
     */
    const getConnection = function () {
        return connection;
    };

    /**
     *  @public
     *  @function register
     *  @param    {(string|RPC[])}  args  It can either receive two arguments,
     *                                    a string and a function, to register
     *                                    one RPC, or it can receive an array of
     *                                    RPC objects, to register them all.
     *  @returns  {Promise}
     *
     *  @description
     *  Registers the given RPCs, biinding each RPC to a name.
     *  It can either register a single RPC, or an array of RPC objects.
     *  Resolves if all RPCs were registered successfully or rejects if one of them fails.
     *
     *  @example <caption>Registering a single RPC:</caption>
     *  //Assuming we have previously connected
     *  const myHello = () => {
     *      console.log("Hello World");
     *  }
     *
     *  crossbar.register("hello", myHello)
     *      .then(() => console.log("great success!"))
     *      .catch(console.log);
     *
     *  @example <caption>Registering multiple RPCs:</caption>
     *  //Assuming we have previously connected
     *  const myHello = () => {
     *      console.log("Hello World");
     *  }
     *
     *  const myGoodbye = () => {
     *      console.log("Goodbye World!");
     *  };
     *
     *  const RPCs = [
     *      { name: "hello" , func: myHello   },
     *      { name: "bye"   , func: myGoodbye }
     *  ];
     *
     *  crossbar.register(RPCs)
     *      .then(() => console.log("great success!"))
     *      .catch(console.log);
     */
    const register = function ( ...args ) {
        const argsArray = Array.from( args );

        if ( Array.isArray( argsArray[ 0 ] ) )
            return registerMany( argsArray[ 0 ] );

        if ( isString( argsArray[ 0 ] ) && isFunction( argsArray[ 1 ] ) && argsArray.length === 2 )
            return registerOne( argsArray[ 0 ], argsArray[ 1 ] );

        return Promise.reject( new Error( "Unrecognized parameters" ) );
    };

    const registerOne = function ( name, func ) {
        if ( !isString( name ) ) {
            return Promise.reject( new TypeError( `${name} must be a String.` ) );
        }

        if ( !isFunction( func ) ) {
            return Promise.reject( new TypeError( `${func} must be a Function.` ) );
        }

        return add(
            "register",
            name,
            deCrossbarify( func ),
            options.register,
            registrationMap
        );
    };

    const registerMany = async function ( rpcList ) {
        for ( const rpc of rpcList ) {
            await registerOne( rpc.name, rpc.func )
                .catch( err => {
                    throw new Error( `Failed to register "${rpc.name}":
                      ${JSON.stringify(err)}` );
                } );
        }
    };

    /**
     *  @public
     *  @function unregister
     *  @param  {...string} args  The names of the RPCs to unregister
     *  @returns {Promise}
     *
     *  @description
     *  Unregisters the RPC with the given name, or all the RPCs with the names provided in the array.
     *  Returns a promise once all RPCs have be unregistered successfully or rejects if one of them fails.
     *
     *  @example <caption>Unregister a single RPC:</caption>
     *  //Assuming we have previously connected and registered "hello"
     *  crossbar.unregister("hello")
     *      .then(() => console.log("great success!"))
     *      .catch(console.log);
     *
     *  @example <caption>Unregister multiple RPCs:</caption>
     *  //Assuming we have previously connected and registered the RPCs with the given names
     *  crossbar.unregister("hello", "bye")
     *      .then(() => console.log("great success!"))
     *      .catch(console.log);
     */
    const unregister = function ( ...args ) {
        return unregisterMany( args );
    };

    const unregisterOne = function ( name ) {
        if ( !isString( name ) ) {
            return Promise.reject( new TypeError( `${name} must be a String.` ) );
        }

        if ( !registrationMap.has( name ) ) {
            return Promise.reject( new Error( `${name} is not registered.` ) );
        }

        return remove(
            "unregister",
            name,
            registrationMap
        );
    };

    const unregisterMany = async function ( rpcNamesList ) {
        for ( const rpcName of rpcNamesList ) {
            await unregisterOne( rpcName )
                .catch( err => {
                    throw new Error( `Failed to unregister "${rpcName.name}":
                      ${JSON.stringify(err)}` );
                } );
        }
    };

    /**
     *  @public
     *  @function call
     *  @param    {string}    rpcName The name of the RPC we wish to call.
     *  @param    {...Object} args    Variable number of arguments we wish to
     *                                pass.
     *  @returns  {Promise}
     *
     *  @description
     *  Calls the RPC with the given name, providing the given arguments.
     *  Resolves if it succeeds, rejects otherwise.
     *
     *  @example <caption>Call an RPC with no arguments:</caption>
     *  //Assuming we have previously connected and registered the RPC "hello"
     *
     *  const hello = () => {
     *      console.log("Hello World");
     *  };
     *
     *  crossbar.call("hello")
     *      .then(() => console.log("great success!"))
     *      .catch(console.log);
     *
     *  @example <caption>Call an RPC with multiple arguments:</caption>
     *  //Assuming we have previously connected and registered the RPC "add"
     *
     *  const add = (n1, n2) => n1 + n2;
     *
     *  crossbar.call("add", 1, 2)
     *      .then(sum => console.log(`sum is: ${sum}`))
     *      .catch(console.log);
     */
    const call = function ( rpcName, ...args ) {
        try {
            return getSession().call( rpcName, args, {}, options.call );
        } catch ( error ) {
            return Promise.reject( error );
        }
    };

    /**
     *  @public
     *  @function getOpts
     *  @returns  {options}
     *
     *  @description  Returns a clone of the options object.
     *
     *  @example <caption>Get a clone of the options object:</caption>
     *  let opts = crossbar.getOpts();
     *  opts = {};  //this wont alter the object being used in crossbarjs
     */
    const getOpts = function () {
        return Object.assign( {}, options );
    };

    /**
     *  @public
     *  @function setOpts
     *  @param    {Object}  newOpts The options we want to add.
     *
     *  @description
     *  Concatenates the given options object with the current one.
     *  This is the only way to change the <code>options</code> object.
     *
     *  @see {options}
     *
     *  @example <caption>Add publish parameters to the options object:</caption>
     *  crossbar.setOpts({
     *      publish: { some options }
     *  });
     *  console.log(JSON.stringify(crossbar.getOpts()));
     *  //will print
     *  //{
     *  //  connect: {
     *  //    "url": "ws://localhost:8080/ws",
     *  //    "realm": "realm1"
     *  //  },
     *  //  publish: { some options },
     *  //  subscribe: {},
     *  //  call: {},
     *  //  register: {}
     *  //}
     */
    const setOpts = function ( newOpts ) {
        Object.assign( options, newOpts );
    };

    /**
     *  @public
     *  @function setOptsDefault
     *
     *  @description  Resets the options object to its default state.
     *
     *  @see  {options}
     */
    const setOptsDefault = function () {
        options = Object.assign( {}, DEFAULT_OPTS );
    };

    /**
     *  @public
     *  @function publish
     *  @param    {string}    topic   The topic of the message.
     *  @param    {...Object} params  The parameters that the subscribed
     *                                functions will receive.
     *  @returns  {Promise}
     *
     *  @description
     *  Publishes the given topic with the given list of variable parameters.
     *  Resolves if it succeeds, rejects otherwise.
     *
     *  @example <caption>Publish a topic:</caption>
     *  //Assuming we are already connected
     *  crossbar.publish("add", 1, 2)
     *      .then(() => console.log("Published!"))
     *      .catch(console.log);
     */
    const publish = function ( topic, ...params ) {
        //autobahn-js only returns promise under specific circumstances. We
        // fix that here.
        let res;
        try {
            res = getSession().publish( topic, params, {}, options.publish );
        } catch ( error ) {
            return Promise.reject( error );
        }

        return options.publish.acknowledge !== undefined ? res : Promise.resolve();
    };

    /**
     *  @public
     *  @function subscribe
     *  @param    {string}    topic     The topic to wich we want to subscribe.
     *  @param    {function}  callback  The function to execute every time we
     *                                  receive a message.
     *  @returns  {Promise}
     *
     *  @description
     *  Subscribes to the given topic, executing the function every time crossbar receives a message.
     *  Resolves if the subscription was successful, rejects otherwise.
     *
     *  @example <caption>Subscribe to the topic "add". See <code>publish</code>:</caption>
     *  //Assuming we are already connected
     *  const myAdd = (n1, n2) => n1 + n2;
     *
     *  crossbar.subscribe("add", myAdd);
     *      .then(() => console.log("Subscribed!"))
     *      .catch(console.log);
     */
    const subscribe = function ( topic, callback ) {

        if ( subscritionMap.has( topic ) ) {
            return Promise.reject( new Error( `Already subscribed to ${topic}` ) );
        }

        return add(
            "subscribe",
            topic,
            deCrossbarify( callback ),
            options.subscribe,
            subscritionMap
        );
    };

    /**
     * @private
     * @function  add
     * @param     {string}    action    A session's function name to execute. In
     *                                  theory it should have been the function
     *                                  itself, but since there were some
     *                                  context issues, I decided to pass the
     *                                  function's name and then execute it.
     * @param     {string}    id        The id of the thing we will be adding.
     * @param     {function}  callback  The function we associate with the given
     *                                  id.
     * @param     {Object}    options   Options object for the action.
     * @param     {Map}       map       The map that will save the association
     *                                  betwwen the id and the result of the
     *                                  action.
     * @returns   {Promise}
     *
     * @description
     * Introduced after codeclimate code quality analysis as a means to remove duplication betwwen regiterOne and subscribe, since they both have the same structure.
     * */
    const add = ( action, id, callback, options, map ) => {
        return getSession()[ action ]( id, callback, options )
            .then( result => {
                map.set( id, {
                    cb: callback,
                    opResult: result
                } );
            } );
    };

    /**
     * @private
     * @function  add
     * @param     {string}    action    A session's function name to execute. In
     *                                  theory it should have been the function
     *                                  itself, but since there were some
     *                                  context issues, I decided to pass the
     *                                  function's name and then execute it.
     * @param     {string}    id        The id of the thing we will be removing.
     * @param     {Map}       map       The map containing the id.
     * @returns   {Promise}
     *
     * @description
     * Introduced after codeclimate code quality analysis as a means to remove duplication betwwen regiterOne and subscribe, since they both have the same structure.
     * */
    const remove = ( action, id, map ) => {
        return getSession()[ action ]( map.get( id ).opResult )
            .then( () => {
                map.delete( id );
            } );
    };

    /**
     * @private
     * @function  deCrossbarify
     * @param     {function}  callback  The function with the actual parameters.
     * @returns   {function}
     *
     * @description
     *  <p>
     *    To register and subscribe to crossbar events, you either need to have all arguments in an array, or in a object.
     *    This approach is counter intuitive and cumbersome, and many beginners have issues with it.
     *  </p>
     *  <p>
     *    This function takes the array argument, and spreads it to the given function.
     *    This way people can have functions with all the arguments listed as subscribers and RPCs.
     *    The code is thus cleaner and easier to reason about.
     *  </p>
     */
    const deCrossbarify = callback => args => callback.call( null, ...args );

    /**
     *  @public
     *  @function unsubscribe
     *  @param    {string}  topic The topic to which we want to unsubscribe.
     *  @returns  {Promise}
     *
     *  @description  Unsubscribes from the given topic. Resolves if successful,
     *                rejects otherwise.
     *
     *  @example <caption>Unsubscribe to the topic "add". See <code>subscribe</code>:</caption>
     *  //Assuming we are already connected
     *  crossbar.unsubscribe("add");
     *      .then(() => console.log("Unsubscribed!"))
     *      .catch(console.log);
     */
    const unsubscribe = function ( topic ) {
        if ( !subscritionMap.has( topic ) ) {
            return Promise.reject( new Error( `Not subscribed to ${topic}` ) );
        }

        return remove(
            "unsubscribe",
            topic,
            subscritionMap
        );
    };

    return Object.freeze( {
        connect,
        disconnect,
        getSession,
        getConnection,
        register,
        unregister,
        call,
        setOpts,
        getOpts,
        setOptsDefault,
        publish,
        subscribe,
        unsubscribe,
        onOpen,
        onClose,
        onRecover,
        onError
    } );
};

module.exports = crossbarFactory;
