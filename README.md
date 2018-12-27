# Cliny

Cliny is the NodeJS backend service for the intranet of the Tierklinik Dobersberg.
It currently features:

 - Integrated user management
 - Planning of a weekly roster
 - Configurable roster-types
 - Controlling the main entry door (using [door-controller](https://github.com/tierklinik-dobersberg/door-controller) via MQTT)
   - based on configured opening hours
   - based on stored calendar events (upcoming)
 - Integration of various Google Caldendars for managing visits
 - Sending mails generated from templates

`cliny` itself only provides a RESTful API, the web frontend is developed in the [dashboard](https://github.com/tierklinik-dobersberg/dashboard) repository.

# License
```
Copyright 2018 Patrick Pacher <patrick.pacher@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR
THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```