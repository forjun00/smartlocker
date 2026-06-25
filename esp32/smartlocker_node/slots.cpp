#include "slots.h"
#include "net.h"
#include <Preferences.h>

const uint16_t PULSE_MS          = 1000;
const bool     RELAY_ACTIVE_HIGH = true;
// false = LED lights when the GPIO is LOW (cathode-to-pin / active-low wiring).
// Set true if your LED lights when the pin is HIGH (anode-to-pin via resistor).
const bool     LED_ACTIVE_HIGH   = false;

const int DEFAULT_SLOT_COUNT = 10;
const int DEFAULT_RELAY_PINS[MAX_SLOTS] = {
  25, 26, 27, 14, 13, 32, 33, 23, 22, 21,
  19, 18,  5,  4, 16, 17     // tail slots for expansion (slots 11..16)
};
// LEDs off by default: the relay defaults already use every "safe" GPIO, so
// there are no free pins to assign automatically. Set each slot's LED GPIO on
// the PINS page (use an I/O expander if you run out of pins). -1 = no LED.
const int DEFAULT_LED_PINS[MAX_SLOTS] = {
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, -1
};

int  slotCount = DEFAULT_SLOT_COUNT;
Slot slots[MAX_SLOTS];
bool relayOn[MAX_SLOTS];
bool lockedState[MAX_SLOTS];
bool doorClosed[MAX_SLOTS];

static Preferences prefs;

void loadSlotMapping() {
  prefs.begin("pins", true);
  slotCount = prefs.getInt("count", DEFAULT_SLOT_COUNT);
  if (slotCount < 1)         slotCount = 1;
  if (slotCount > MAX_SLOTS) slotCount = MAX_SLOTS;
  for (int i = 0; i < MAX_SLOTS; i++) {
    char rk[6]; snprintf(rk, sizeof(rk), "p%d", i);
    char lk[6]; snprintf(lk, sizeof(lk), "l%d", i);
    int relay = prefs.getInt(rk, DEFAULT_RELAY_PINS[i]);
    int led   = prefs.getInt(lk, DEFAULT_LED_PINS[i]);
    slots[i] = { i + 1, relay, -1, led };      // no door sensor
  }
  prefs.end();
}

void saveSlotMapping() {
  prefs.begin("pins", false);
  prefs.putInt("count", slotCount);
  for (int i = 0; i < MAX_SLOTS; i++) {
    char rk[6]; snprintf(rk, sizeof(rk), "p%d", i);
    char lk[6]; snprintf(lk, sizeof(lk), "l%d", i);
    prefs.putInt(rk, slots[i].relayPin);
    prefs.putInt(lk, slots[i].ledPin);
  }
  prefs.end();
}

void initSlots() {
  loadSlotMapping();
  for (int i = 0; i < slotCount; i++) {
    pinMode(slots[i].relayPin, OUTPUT);
    driveRelay(i, false);
    lockedState[i] = false;
    if (slots[i].ledPin >= 0) {
      pinMode(slots[i].ledPin, OUTPUT);
      driveLed(i);                 // empty at boot -> LED on
    }
    if (slots[i].doorPin >= 0) {
      pinMode(slots[i].doorPin, INPUT_PULLUP);
      doorClosed[i] = digitalRead(slots[i].doorPin) == LOW;
    } else {
      doorClosed[i] = true;
    }
  }
}

Slot* findSlotById(int id) {
  for (int i = 0; i < slotCount; i++) if (slots[i].id == id) return &slots[i];
  return nullptr;
}

void driveRelay(int idx, bool on) {
  relayOn[idx] = on;
  digitalWrite(slots[idx].relayPin, (RELAY_ACTIVE_HIGH ? on : !on) ? HIGH : LOW);
}

// LED on when the slot is empty (unlocked), off when a parcel is locked in.
void driveLed(int idx) {
  if (slots[idx].ledPin < 0) return;
  bool on = !lockedState[idx];
  digitalWrite(slots[idx].ledPin, (LED_ACTIVE_HIGH ? on : !on) ? HIGH : LOW);
}

void doLock(int idx) {
  driveRelay(idx, true);
  delay(PULSE_MS);
  driveRelay(idx, false);
  lockedState[idx] = true;
  driveLed(idx);                 // parcel in -> LED off
  publishState(idx);
}

void doUnlock(int idx) {
  driveRelay(idx, true);
  delay(PULSE_MS);
  driveRelay(idx, false);
  lockedState[idx] = false;
  driveLed(idx);                 // empty -> LED on
  publishState(idx);
}

void manualPulse(int idx) {
  driveRelay(idx, true);
  delay(PULSE_MS);
  driveRelay(idx, false);
}

void pollDoors() {
  for (int i = 0; i < slotCount; i++) {
    if (slots[i].doorPin < 0) continue;
    bool closed = digitalRead(slots[i].doorPin) == LOW;
    if (closed != doorClosed[i]) {
      doorClosed[i] = closed;
      publishDoor(i);
    }
  }
}
