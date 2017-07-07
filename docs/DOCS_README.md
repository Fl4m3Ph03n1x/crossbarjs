<div align="center">
    <img src="https://raw.githubusercontent.com/Fl4m3Ph03n1x/crossbarjs/master/logos/logo_no_wm.png">
</div>
<div align="center">

[![NPM](https://nodei.co/npm/crossbarjs.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/crossbarjs/)

[![Build Status](https://travis-ci.org/Fl4m3Ph03n1x/crossbarjs.svg?branch=master)](https://travis-ci.org/Fl4m3Ph03n1x/crossbarjs) [![codecov](https://codecov.io/gh/Fl4m3Ph03n1x/crossbarjs/branch/master/graph/badge.svg)](https://codecov.io/gh/Fl4m3Ph03n1x/crossbarjs) [![Dependency Status](https://www.versioneye.com/user/projects/595622b0368b0800512ab2ac/badge.svg)](https://www.versioneye.com/user/projects/595622b0368b0800512ab2ac) [![Code Climate](https://codeclimate.com/github/Fl4m3Ph03n1x/crossbarjs/badges/gpa.svg)](https://codeclimate.com/github/Fl4m3Ph03n1x/crossbarjs) [![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/dwyl/esta/issues)

</div>

# What

Technically speaking `crossbarjs` is a Facade over [`autobahn-js`](https://github.com/crossbario/autobahn-js).

In practice, it is a library whose main purpose is to make interactions with crossbar easier, with support and focus over the 4 main crossbar functionalities and their counterparts:

 - publish
 - subscribe/unsubscribe
 - register/unregister
 - call

Without compromising access to any of the more advanced functionalities provided in the layer bellow.

# Why

`autobahn-js` API is long and it breaks the principle of [least astonishment](https://en.wikipedia.org/wiki/Principle_of_least_astonishment). To use it you need to go through pages of sparse documentation understand advanced principles of JavaScript.

`crossbarjs` is an attempt at fixing that. The API it provides is as simple and beginner friendly as possible and its purpose is to make sure that all you need to run crossbario is to download this module and run it without spending extra time on docs, as it is designed to be as intuitive as possible.

And if you still need some advanced options, you can always use them via an `options` object.

# How

Following are instructions on how to intsall and use `crossbarjs`. For more information about the project you can check GitHub page:

 - [crossbarjs Github](https://github.com/Fl4m3Ph03n1x/crossbarjs)

And for questions you can ask in the issues page:

 - [crossbarjs Issues](https://github.com/Fl4m3Ph03n1x/crossbarjs/issues)

## Install

    npm install crossbarjs --save

##  Examples

Each method is documented with its own examples. For further usage cases you can check the modules page.

Connect and publish a message:

```
const crossbarjs = require("crossbarjs");

const crossbar  = crossbarjs();

crossbar.connect()
    .then(() => {
        crossbar.publish("myTopic", "arg1", "arg2");
    })
    .catch(console.log);
```

Subscribe to a topic:

```
const crossbarjs = require("crossbarjs");

const crossbar  = crossbarjs();

crossbar.connect()
    .then(() => {
        const print = (str1, str2) => console.log(`str1 is ${str1}, str2 is ${str2}`);
        return crossbar.subscribe("myTopic", print);
    })
    .catch(console.log);
```

Register a bunch of RPCs:

```
const crossbarjs = require("crossbarjs");

const crossbar  = crossbarjs();
    //after connecting
    const print = (str1, str2) => console.log(`str1 is ${str1}, str2 is ${str2}`);
    const add3 = (n1, n2, n3) => n1 + n2 + n3;

    crossbar.register([
        { "print": func: print },
        { "addThreeNumbers" : func: add3 }
    ])
    .then(() => console.log("Register successful"))
    .catch(console.log);
```

Unregister a bunch of RPCs:

```
//after connecting and registering
crossbar.unregister("print", "addThreeNumbers")
    .then(() => console.log("Unregister successful"))
    .catch(console.log);
```

Call an RPC:

```
    //after connecting and registering
    crossbar.call("addThreeNumbers", 1, 2, 3)
        .then(res => console.log(res))
        .catch(console.log);
```
