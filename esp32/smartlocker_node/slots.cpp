#include "slots.h"
#include "net.h"

const uint16_t PULSE_MS         = 1000;
const bool     RELAY_ACTIVE_HIGH = true;

// To add more slots: append rows and bump NUM_SLOTS. Avoid GPIO 0,2,6-11,12,15
// (boot/strapping/flash) and 34-39 (input only).
Slot slots[] = {
  {  1, 25, -1 },
  {  2, 26, -1 },
  {  3, 27, -1 },
  {  4, 14, -1 },
  {  5, 13, -1 },
  {  6, 32, -1 },
  {  7, 33, -1 },
  {  8, 23, -1 },
  {  9, 22, -1 },
  { 10, 21, -1 },
};
const int NUM_SLOTS = sizeof(slots) / sizeof(slots[0]);

bool relayOn[16];
bool lockedState[16];
bool doorClosed[16];

void initSlots() {
  for (int i = 0; i < NUM_SLOTS; i++) {
    pinMode(slots[i].relayPin, OUTPUT);
    driveRelay(i, false);
    lockedState[i] = false;
    if (slots[i].doorPin >= 0) {
      pinMode(slots[i].doorPin, INPUT_PULLUP);
      doorClosed[i] = digitalRead(slots[i].doorPin) == LOW;
    } else {
      doorClosed[i] = true;
    }
  }
}

Slot* findSlotById(int id) {
  for (int i = 0; i < NUM_SLOTS; i++) if (slots[i].id == id) return &slots[i];
  return nullptr;
}

void driveRelay(int idx, bool on) {
  relayOn[idx] = on;
  digitalWrite(slots[idx].relayPin, (RELAY_ACTIVE_HIGH ? on : !on) ? HIGH : LOW);
}

void doLock(int idx) {
  driveRelay(idx, true);
  delay(PULSE_MS);
  driveRelay(idx, false);
  lockedState[idx] = true;
  publishState(idx);
}

void doUnlock(int idx) {
  driveRelay(idx, true);
  delay(PULSE_MS);
  driveRelay(idx, false);
  lockedState[idx] = false;
  publishState(idx);
}

void manualPulse(int idx) {
  driveRelay(idx, true);
  delay(PULSE_MS);
  driveRelay(idx, false);
}

void pollDoors() {
  for (int i = 0; i < NUM_SLOTS; i++) {
    if (slots[i].doorPin < 0) continue;
    bool closed = digitalRead(slots[i].doorPin) == LOW;
    if (closed != doorClosed[i]) {
      doorClosed[i] = closed;
      publishDoor(i);
    }
  }
}
