Vue.component('draft_info', {
  props: ['league_info', 'status_slug', 'current_page', 'is_admin'],
  template:
    '<div class="league-header">' +
      '<div class="league-header-top">' +
        '<img class="league-header-icon" :src="\'/images/league_icons/\' + league_info.icon">' +
        '<h1 class="league-header-name" :style="\'color:\'+league_info.color1">{{league_info.name}}</h1>' +
        '<span class="status-badge" :class="status_slug">{{league_info.status}}</span>' +
      '</div>' +
      '<div class="league-header-meta">' +
        '<span class="meta-chip">{{league_info.game_version === \'classic\' ? \'Classic\' : \'Retail\'}}</span>' +
        '<span class="meta-sep">&middot;</span>' +
        '<span class="meta-chip">{{(league_info.region || \'us\').toUpperCase()}}</span>' +
        '<span class="meta-sep">&middot;</span>' +
        '<span class="meta-chip">{{league_info.style || \'Snake\'}} Draft</span>' +
        '<span class="meta-sep">&middot;</span>' +
        '<span class="meta-chip">{{league_info.report_day || \'Monday\'}} reports</span>' +
        '<span class="meta-sep">&middot;</span>' +
        '<span class="meta-chip">Org: {{league_info.admin.name}}</span>' +
      '</div>' +
      '<div class="league-header-nav">' +
        '<a :href="\'/leagues/\' + league_info.code" :class="{active: current_page === \'home\'}"><i class="fas fa-home"></i> Home</a>' +
        '<a :href="\'/leagues/\' + league_info.code + \'/teams\'" :class="{active: current_page === \'teams\'}"><i class="fas fa-flag"></i> Teams</a>' +
        '<a :href="\'/leagues/\' + league_info.code + \'/rankings\'" :class="{active: current_page === \'rankings\'}"><i class="fas fa-calendar-alt"></i> Rankings</a>' +
        '<a :href="\'/proplayers/\' + league_info.code" :class="{active: current_page === \'players\'}"><i class="fas fa-list"></i> Players</a>' +
        '<a :href="\'/leagues/\' + league_info.code + \'/settings\'" :class="{active: current_page === \'settings\'}"><i class="fas fa-cog"></i> {{is_admin ? \'Settings\' : \'Info\'}}</a>' +
      '</div>' +
    '</div>'
});
