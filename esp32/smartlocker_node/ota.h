#pragma once
#include <Arduino.h>

void setupOTA();        // ArduinoOTA + register web upload routes
void serviceOTA();      // call from loop()
