/**
 * Live data source.
 * ------------------------------------------------------------------
 * The directory is fed from a Google Sheet, published to the web as
 * CSV (File > Share > Publish to web > select the sheet > CSV).
 * common.js fetches this URL and parses it into restaurant objects.
 *
 * Expected columns (in this order):
 *   Restaurant, Restaurant Type, Date Posted, Address, Video Link,
 *   Restaurant Website, Lat, Lon
 * ------------------------------------------------------------------
 */

const RESTAURANTS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTqiAuXaS7947xRntXY5LAdzDqHNuZnjJmaJNquc-68FFMkpGhkWVvarPN-W_GULo5YY4HDPsG6xyAk/pub?output=csv";
