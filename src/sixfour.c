#include <pebble.h>

// Uncomment for debug mode
#define DEBUG 1

#ifdef DEBUG
#define DLOG(fmt, ...) app_log(APP_LOG_LEVEL_DEBUG, __FILE__, __LINE__, fmt, __VA_ARGS__)
#else
#define DLOG(fmt, ...)
#endif

static Window *window;

static TextLayer *score_text_layer;
static TextLayer *overs_text_layer;
static TextLayer *lead_text_layer;
static TextLayer *striker_name_text_layer;
static TextLayer *striker_stats_text_layer;
static TextLayer *nonstriker_name_text_layer;
static TextLayer *nonstriker_stats_text_layer;
static TextLayer *bowler_name_text_layer;
static TextLayer *bowler_stats_text_layer;
TextLayer *text_time_layer;
TextLayer *text_date_layer;
Layer *line_layer;


void line_layer_update_callback(Layer *layer, GContext* ctx) {
  graphics_context_set_fill_color(ctx, GColorWhite);
  graphics_fill_rect(ctx, layer_get_bounds(layer), 0, GCornerNone);
}


static AppSync sync;
static uint8_t sync_buffer[256];

enum SixFourKey {
  SIXFOUR_SCORE_KEY = 0x1,
  SIXFOUR_OVERS_KEY,
  SIXFOUR_LEAD_KEY,
  SIXFOUR_STRIKER_NAME_KEY,
  SIXFOUR_STRIKER_STATS_KEY,
  SIXFOUR_NONSTRIKER_NAME_KEY,
  SIXFOUR_NONSTRIKER_STATS_KEY,
  SIXFOUR_BOWLER_NAME_KEY,
  SIXFOUR_BOWLER_STATS_KEY
};

static void sync_error_callback(DictionaryResult dict_error, AppMessageResult app_message_error, void *context) {
    APP_LOG(APP_LOG_LEVEL_DEBUG, "App Message Sync Error: %d", app_message_error);
}

static void sync_tuple_changed_callback(const uint32_t key, const Tuple* new_tuple, const Tuple* old_tuple, void* context) {
    APP_LOG(APP_LOG_LEVEL_DEBUG, "change key %d val %s", (int)key, new_tuple->value->cstring);
    switch (key) {
        case SIXFOUR_SCORE_KEY:
            text_layer_set_text(score_text_layer, new_tuple->value->cstring);
            break;
        case SIXFOUR_OVERS_KEY:
            text_layer_set_text(overs_text_layer, new_tuple->value->cstring);
            break;
        case SIXFOUR_LEAD_KEY:
            text_layer_set_text(lead_text_layer, new_tuple->value->cstring);
            break;
        case SIXFOUR_STRIKER_NAME_KEY:
            text_layer_set_text(striker_name_text_layer, new_tuple->value->cstring);
            break;
        case SIXFOUR_STRIKER_STATS_KEY:
            text_layer_set_text(striker_stats_text_layer, new_tuple->value->cstring);
            break;
        case SIXFOUR_NONSTRIKER_NAME_KEY:
            text_layer_set_text(nonstriker_name_text_layer, new_tuple->value->cstring);
            break;
        case SIXFOUR_NONSTRIKER_STATS_KEY:
            text_layer_set_text(nonstriker_stats_text_layer, new_tuple->value->cstring);
            break;
        case SIXFOUR_BOWLER_NAME_KEY:
            text_layer_set_text(bowler_name_text_layer, new_tuple->value->cstring);
            break;
        case SIXFOUR_BOWLER_STATS_KEY:
            text_layer_set_text(bowler_stats_text_layer, new_tuple->value->cstring);
            break;
    }
}

static void handle_minute_tick(struct tm* tick_time, TimeUnits units_changed) 
{
    APP_LOG(APP_LOG_LEVEL_DEBUG, "tick");

    static char time_text[] = "00:00";
    static char date_text[] = "00/00/0000";

    char *time_format;
  
    if (!tick_time) {
      time_t now = time(NULL);
      tick_time = localtime(&now);
    }

    // TODO: Only update the date when it's changed.
    strftime(date_text, sizeof(date_text), "%d/%m/%Y", tick_time);
    text_layer_set_text(text_date_layer, date_text);
  
    if (clock_is_24h_style()) {
      time_format = "%R";
    } else {
      time_format = "%I:%M";
    }
  
    strftime(time_text, sizeof(time_text), time_format, tick_time);
  
    // Kludge to handle lack of non-padded hour format string
    // for twelve hour clock.
    if (!clock_is_24h_style() && (time_text[0] == '0')) {
      memmove(time_text, &time_text[1], sizeof(time_text) - 1);
    }
    
    text_layer_set_text(text_time_layer, time_text);
        
    DictionaryIterator *iter;
    app_message_outbox_begin(&iter);
    app_message_outbox_send();
    
}

void handle_deinit(void) {
  tick_timer_service_unsubscribe();
}

static void window_load(Window *window) {
    Layer *window_layer = window_get_root_layer(window);

    // 144x168

    score_text_layer = text_layer_create(GRect(0, 0, 144, 28));
    text_layer_set_text_color(score_text_layer, GColorWhite);
    text_layer_set_background_color(score_text_layer, GColorClear);
    text_layer_set_font(score_text_layer, fonts_get_system_font(FONT_KEY_GOTHIC_28));
    text_layer_set_text_alignment(score_text_layer, GTextAlignmentLeft);
    layer_add_child(window_layer, text_layer_get_layer(score_text_layer));

    overs_text_layer = text_layer_create(GRect(0, 0, 144, 28));
    text_layer_set_text_color(overs_text_layer, GColorWhite);
    text_layer_set_background_color(overs_text_layer, GColorClear);
    text_layer_set_font(overs_text_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
    text_layer_set_text_alignment(overs_text_layer, GTextAlignmentRight);
    layer_add_child(window_layer, text_layer_get_layer(overs_text_layer));

    lead_text_layer = text_layer_create(GRect(0, 28, 144, 28));
    text_layer_set_text_color(lead_text_layer, GColorWhite);
    text_layer_set_background_color(lead_text_layer, GColorClear);
    text_layer_set_font(lead_text_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
    text_layer_set_text_alignment(lead_text_layer, GTextAlignmentLeft);
    layer_add_child(window_layer, text_layer_get_layer(lead_text_layer));

    striker_name_text_layer = text_layer_create(GRect(0, 58, 144, 28));
    text_layer_set_text_color(striker_name_text_layer, GColorWhite);
    text_layer_set_background_color(striker_name_text_layer, GColorClear);
    text_layer_set_font(striker_name_text_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
    text_layer_set_text_alignment(striker_name_text_layer, GTextAlignmentLeft);
    layer_add_child(window_layer, text_layer_get_layer(striker_name_text_layer));

    striker_stats_text_layer = text_layer_create(GRect(0, 58, 144, 28));
    text_layer_set_text_color(striker_stats_text_layer, GColorWhite);
    text_layer_set_background_color(striker_stats_text_layer, GColorClear);
    text_layer_set_font(striker_stats_text_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
    text_layer_set_text_alignment(striker_stats_text_layer, GTextAlignmentRight);
    layer_add_child(window_layer, text_layer_get_layer(striker_stats_text_layer));

    nonstriker_name_text_layer = text_layer_create(GRect(0, 82, 144, 28));
    text_layer_set_text_color(nonstriker_name_text_layer, GColorWhite);
    text_layer_set_background_color(nonstriker_name_text_layer, GColorClear);
    text_layer_set_font(nonstriker_name_text_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
    text_layer_set_text_alignment(nonstriker_name_text_layer, GTextAlignmentLeft);
    layer_add_child(window_layer, text_layer_get_layer(nonstriker_name_text_layer));

    nonstriker_stats_text_layer = text_layer_create(GRect(0, 82, 144, 28));
    text_layer_set_text_color(nonstriker_stats_text_layer, GColorWhite);
    text_layer_set_background_color(nonstriker_stats_text_layer, GColorClear);
    text_layer_set_font(nonstriker_stats_text_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
    text_layer_set_text_alignment(nonstriker_stats_text_layer, GTextAlignmentRight);
    layer_add_child(window_layer, text_layer_get_layer(nonstriker_stats_text_layer));

    bowler_name_text_layer = text_layer_create(GRect(0, 112, 144, 28));
    text_layer_set_text_color(bowler_name_text_layer, GColorWhite);
    text_layer_set_background_color(bowler_name_text_layer, GColorClear);
    text_layer_set_font(bowler_name_text_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
    text_layer_set_text_alignment(bowler_name_text_layer, GTextAlignmentLeft);
    layer_add_child(window_layer, text_layer_get_layer(bowler_name_text_layer));

    bowler_stats_text_layer = text_layer_create(GRect(0, 112, 144, 28));
    text_layer_set_text_color(bowler_stats_text_layer, GColorWhite);
    text_layer_set_background_color(bowler_stats_text_layer, GColorClear);
    text_layer_set_font(bowler_stats_text_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
    text_layer_set_text_alignment(bowler_stats_text_layer, GTextAlignmentRight);
    layer_add_child(window_layer, text_layer_get_layer(bowler_stats_text_layer));
  
    GRect line_frame = GRect(0, 145, 144, 1);
    line_layer = layer_create(line_frame);
    layer_set_update_proc(line_layer, line_layer_update_callback);
    layer_add_child(window_layer, line_layer);
    
    text_time_layer = text_layer_create(GRect(0, 142, 144, 24));
    text_layer_set_text_color(text_time_layer, GColorWhite);
    text_layer_set_background_color(text_time_layer, GColorClear);
    text_layer_set_font(text_time_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
    text_layer_set_text_alignment(text_time_layer, GTextAlignmentLeft);
    layer_add_child(window_layer, text_layer_get_layer(text_time_layer));
  
    text_date_layer = text_layer_create(GRect(0, 142, 144, 24));
    text_layer_set_text_color(text_date_layer, GColorWhite);
    text_layer_set_background_color(text_date_layer, GColorClear);
    text_layer_set_font(text_date_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
    text_layer_set_text_alignment(text_date_layer, GTextAlignmentRight);
    layer_add_child(window_layer, text_layer_get_layer(text_date_layer));

    Tuplet initial_values[] = {
        TupletCString(SIXFOUR_SCORE_KEY, ""),
        TupletCString(SIXFOUR_OVERS_KEY, ""),
        TupletCString(SIXFOUR_LEAD_KEY, "Loading..."),
        TupletCString(SIXFOUR_STRIKER_NAME_KEY, ""),
        TupletCString(SIXFOUR_STRIKER_STATS_KEY, ""),
        TupletCString(SIXFOUR_NONSTRIKER_NAME_KEY, ""),
        TupletCString(SIXFOUR_NONSTRIKER_STATS_KEY, ""),
        TupletCString(SIXFOUR_BOWLER_NAME_KEY, ""),
        TupletCString(SIXFOUR_BOWLER_STATS_KEY, ""),
    };

    APP_LOG(APP_LOG_LEVEL_DEBUG, "want dict buffer: %d", (int) dict_calc_buffer_size_from_tuplets(initial_values, 10));

    app_sync_init(&sync, sync_buffer, sizeof(sync_buffer), initial_values, ARRAY_LENGTH(initial_values),
            sync_tuple_changed_callback, sync_error_callback, NULL);
}

static void window_unload(Window *window) {
    app_sync_deinit(&sync);

    text_layer_destroy(score_text_layer);
    text_layer_destroy(overs_text_layer);
    text_layer_destroy(lead_text_layer);
    text_layer_destroy(striker_name_text_layer);
    text_layer_destroy(striker_stats_text_layer);
    text_layer_destroy(nonstriker_name_text_layer);
    text_layer_destroy(nonstriker_stats_text_layer);
    text_layer_destroy(bowler_name_text_layer);
    text_layer_destroy(bowler_stats_text_layer);
}

static void init(void) {
    window = window_create();
    window_set_background_color(window, GColorBlack);
    window_set_fullscreen(window, true);
    window_set_window_handlers(window, (WindowHandlers) {
        .load = window_load,
        .unload = window_unload
    });

    app_message_open(sizeof(sync_buffer), 32);

    const bool animated = true;
    window_stack_push(window, animated);

    tick_timer_service_subscribe(MINUTE_UNIT, &handle_minute_tick);
      
    APP_LOG(APP_LOG_LEVEL_DEBUG, "init done");
}

static void deinit(void) {
    window_destroy(window);
}

int main(void) {
    init();
    app_event_loop();
    deinit();
}
