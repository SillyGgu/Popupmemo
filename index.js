import {
    eventSource,
    event_types,
    saveSettingsDebounced
} from '../../../../script.js';

import {
    getContext,
    extension_settings,
    loadExtensionSettings
} from '../../../extensions.js';

import {
    characters,
    this_chid,
    getThumbnailUrl
} from '../../../../script.js';

import {
    user_avatar
} from '../../../personas.js';

const extensionName = 'Popupmemo';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const DEFAULT_AVATAR_PATH = '/img/five.png';

let charBubbleTimer;
let charCurrentBubbleIndex = 0;
let userBubbleTimer;
let userCurrentBubbleIndex = 0;





const DEFAULT_SETTINGS = {
    enabled: true,
    ignoreClick: false,
    
    pos: { top: 50, left: 50 },
    width: 350,
    height: 250,
    bgOpacity: 0.7,
    bgImage: '',
    
    charBubbleColor: '#FFFFFF', 
    userBubbleColor: '#F0F0F0', 
    
    charBubbles: ['', '', ''],
    
    userBubbles: ['', '', ''],
    
    
    
    charData: {}
};
let settings;







function createMemoPopup() {
    const memoHTML = `
        <div id="popup-memo-container">
            <div id="memo-header">
                <div id="memo-profile-area">
                    <img id="memo-char-avatar" src="${DEFAULT_AVATAR_PATH}" alt="Character Avatar">
                    <div id="memo-bubble-display" class="speech-bubble-container">
                        <span class="speech-bubble" id="memo-bubble-content"></span>
                    </div>
                </div>
                <div id="memo-controls-area">
                    <button id="memo-toggle-ignore" class="memo-control-btn" title="클릭 무시 토글 (드래그 불가)">
                        <i class="fa-solid fa-hand-pointer"></i>
                    </button>
                </div>
            </div>
            <textarea id="popup-memo-textarea" placeholder="여기에 메모를 작성하세요. 내용은 캐릭터별로 자동 저장됩니다."></textarea>
            
            <div id="memo-user-area">
                <div id="memo-user-bubble-display" class="speech-bubble-container user-speech-bubble-container">
                    <span class="speech-bubble user-speech-bubble" id="memo-user-bubble-content"></span>
                </div>
                <img id="memo-user-avatar" src="${DEFAULT_AVATAR_PATH}" alt="User Avatar">
            </div>
        </div>
    `;
    $('body').append(memoHTML);

    const $memoContainer = $('#popup-memo-container');
    const $memoTextarea = $('#popup-memo-textarea');

    
    $('#memo-toggle-ignore').on('click', toggleIgnoreClick);
    $memoTextarea.on('input', saveMemoContentDebounced);

    
    bindDragFunctionality($memoContainer);

    
    $memoTextarea.on('mousedown', (e) => e.stopPropagation());

    
    $memoContainer.on('mouseup', function() {
        const currentWidth = $memoContainer.width();
        const currentHeight = $memoContainer.height();

        if (settings.width !== currentWidth || settings.height !== currentHeight) {
            settings.width = currentWidth;
            settings.height = currentHeight;
            saveSettingsDebounced();
        }
    });
}


function bindDragFunctionality($element) {
    let isDragging = false;
    let offsetX, offsetY;
    const container = $element[0];

    $element.on('mousedown', (e) => {
        
        if ($(e.target).is('#memo-char-avatar') || $(e.target).is('#memo-user-avatar')) {
            return;
        }
        
        const rect = container.getBoundingClientRect();
        const isResizeHandle = (e.clientX > rect.right - 10 && e.clientY > rect.bottom - 10);

        if ($(e.target).closest('#memo-controls-area').length || $(e.target).is('#popup-memo-textarea') || isResizeHandle) {
            return;
        }

        isDragging = true;
        offsetX = e.clientX - container.getBoundingClientRect().left;
        offsetY = e.clientY - container.getBoundingClientRect().top;
        $element.addClass('grabbing');
    });

    $(document).on('mousemove', (e) => {
        if (!isDragging) return;

        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

        
        newLeft = Math.max(0, newLeft);
        newTop = Math.min(newTop, window.innerHeight - container.offsetHeight);

        container.style.left = `${newLeft}px`;
        container.style.top = `${newTop}px`;

        settings.pos.left = newLeft;
        settings.pos.top = newTop;
        saveSettingsDebounced();
    });

    $(document).on('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            $element.removeClass('grabbing');
        }
    });
}







function getCurrentCharData() {
    const charId = this_chid || 'no_char_selected'; 
    if (!settings.charData[charId]) {
        settings.charData[charId] = {
            memoContent: '', 
            charBubbles: ['', '', ''], 
            charImageOverride: '',
            userCharBubbles: ['', '', ''], 
            userImageOverride: '', 
        };
    }
    
    
    if (!settings.charData[charId].charBubbles) settings.charData[charId].charBubbles = ['', '', ''];
    if (!settings.charData[charId].userCharBubbles) settings.charData[charId].userCharBubbles = ['', '', ''];
    if (!settings.charData[charId].userImageOverride) settings.charData[charId].userImageOverride = ''; 

    return settings.charData[charId];
}


function applySettings() {
    const $memoContainer = $('#popup-memo-container');
    const $memoTextarea = $('#popup-memo-textarea');
    const $toggleBtn = $('#memo-toggle-ignore');
    const charData = getCurrentCharData();

    
    $memoContainer.toggle(settings.enabled);

    
    $memoContainer.css({
        top: `${settings.pos.top}px`,
        left: `${settings.pos.left}px`,
        width: `${settings.width}px`,
        height: `${settings.height}px`,
    });

    
    $memoTextarea.val(charData.memoContent); 
    
    
    const individualCharBubbles = charData.charBubbles.filter(b => b.trim() !== '');
    let charBubblesToDisplay = individualCharBubbles.length > 0 ? charData.charBubbles : settings.charBubbles;
    
    
    const individualUserBubbles = charData.userCharBubbles.filter(b => b.trim() !== '');
    let userBubblesToDisplay = individualUserBubbles.length > 0 ? charData.userCharBubbles : settings.userBubbles;
    
    
    $memoContainer.get(0).style.setProperty('--char-bubble-color', settings.charBubbleColor);
    $('#memo-bubble-display').css('background-color', settings.charBubbleColor);
    
    $memoContainer.get(0).style.setProperty('--user-bubble-color', settings.userBubbleColor);
    $('#memo-user-bubble-display').css('background-color', settings.userBubbleColor);


    updateBubbleDisplay(charBubblesToDisplay, '#memo-bubble-content'); 
    updateBubbleDisplay(userBubblesToDisplay, '#memo-user-bubble-content'); 

    
    $memoContainer.toggleClass('ignore-click', settings.ignoreClick);
    $toggleBtn.toggleClass('active', settings.ignoreClick); 

    
    applyBackgroundStyle();

    
    updateProfileImages(); 
    
    
    renderCharMemoList();
}

function applyBackgroundStyle() {
    const $memoContainer = $('#popup-memo-container');
    const opacity = settings.bgOpacity || 0.7;
    const imageURL = settings.bgImage;

    $memoContainer.css({
        'background-color': `rgba(255, 255, 255, ${opacity})`,
        'background-image': imageURL ? `url(${imageURL})` : 'none',
        'background-size': 'cover',
        'background-position': 'center',
        'background-blend-mode': 'overlay',
        'backdrop-filter': imageURL ? 'none' : 'blur(5px)',
    });
}


function updateProfileImages() {
    const charId = this_chid;
    const currentCharCard = characters[charId]; 
    const charData = getCurrentCharData();

    
    let charPath = DEFAULT_AVATAR_PATH;
    if (charData.charImageOverride && charData.charImageOverride.trim() !== '') { 
        charPath = charData.charImageOverride.trim();
    } else if (currentCharCard && currentCharCard.avatar) {
        charPath = `/thumbnail?type=avatar&file=${currentCharCard.avatar}`;
    }
    
    
    let personaPath = DEFAULT_AVATAR_PATH;
    
    if (charData.userImageOverride && charData.userImageOverride.trim() !== '') { 
        personaPath = charData.userImageOverride.trim();
    } else {
        const personaFileName = user_avatar;
        if (personaFileName) {
            if (typeof getThumbnailUrl === 'function') {
                personaPath = getThumbnailUrl('persona', personaFileName, true); 
            } else {
                personaPath = `/thumbnail?type=persona&file=${personaFileName}`; 
            }
        }
    }
    
    
    $('#memo-char-avatar').attr('src', charPath);
    $('#memo-user-avatar').attr('src', personaPath);
}


function startBubbleRotation(bubbles, contentSelector, timerRef, indexRef) {
    const $bubbleContent = $(contentSelector);
    const $bubbleContainer = $bubbleContent.parent();

    if (timerRef) {
        clearInterval(timerRef);
    }

    const validBubbles = bubbles.filter(b => b.trim() !== '');

    if (validBubbles.length === 0) {
        $bubbleContent.text('').css('opacity', 0);
        $bubbleContainer.removeClass('bubble-flicker-in bubble-flicker-out');
        return { timer: null, index: 0 };
    }

    
    if (validBubbles.length <= 1) {
        $bubbleContent.text(validBubbles[0]).css('opacity', 1);
        $bubbleContainer.removeClass('bubble-flicker-in bubble-flicker-out');
        return { timer: null, index: 0 }; 
    }


    let currentIndex = indexRef;

    const rotateBubble = () => {
        const text = validBubbles[currentIndex];

        
        $bubbleContainer.addClass('bubble-flicker-out');
        
        setTimeout(() => {
            $bubbleContent.text(text).css('opacity', 1);

            
            $bubbleContainer.removeClass('bubble-flicker-out');
            $bubbleContainer.addClass('bubble-flicker-in');
            
            setTimeout(() => {
                $bubbleContainer.removeClass('bubble-flicker-in');
            }, 500); 

            currentIndex = (currentIndex + 1) % validBubbles.length;
        }, 300); 
    };

    rotateBubble();
    const newTimer = setInterval(rotateBubble, 7000); 

    return { timer: newTimer, index: currentIndex };
}

function updateBubbleDisplay(bubbles, contentSelector) {
    if (contentSelector === '#memo-bubble-content') { 
        const { timer, index } = startBubbleRotation(bubbles, contentSelector, charBubbleTimer, charCurrentBubbleIndex);
        charBubbleTimer = timer;
        charCurrentBubbleIndex = index;
    } else if (contentSelector === '#memo-user-bubble-content') { 
        const { timer, index } = startBubbleRotation(bubbles, contentSelector, userBubbleTimer, userCurrentBubbleIndex);
        userBubbleTimer = timer;
        userCurrentBubbleIndex = index;
    }
}







const saveMemoContentDebounced = debounce(() => {
    const charData = getCurrentCharData();
    charData.memoContent = $('#popup-memo-textarea').val();
    saveSettingsDebounced();
    renderCharMemoList();
}, 500);


function toggleIgnoreClick() {
    settings.ignoreClick = !settings.ignoreClick;
    applySettings(); 
    saveSettingsDebounced();
}


function renderCharMemoList() {
    const $container = $('#memo_char_list_container');
    $container.empty();

    const charMemoEntries = Object.entries(settings.charData)
        .filter(([charId, data]) => charId !== 'no_char_selected' && data.memoContent && data.memoContent.trim() !== '');

    if (charMemoEntries.length === 0) {
        $container.append('<p style="text-align: center; color: #777; margin: 0;">저장된 캐릭터 메모가 없습니다.</p>');
        return;
    }

    charMemoEntries.forEach(([charId, data]) => {
        const charCard = characters[charId];
        const charName = charCard && charCard.name ? charCard.name : `(ID: ${charId.substring(0, 8)}...)`;
        
        const firstLine = data.memoContent.trim().split('\n')[0];
        const memoPreview = firstLine.substring(0, 50) + (firstLine.length > 50 || data.memoContent.split('\n').length > 1 ? '...' : '');

        const listItem = `
            <div class="memo-list-item" data-char-id="${charId}">
                <div class="memo-list-item-content" title="${data.memoContent}">
                    <b>${charName}</b>: ${memoPreview}
                </div>
                <button class="memo-delete-btn" data-char-id="${charId}" title="${charName} 메모 삭제">
                    <i class="fa-solid fa-trash-can"></i> 삭제
                </button>
            </div>
        `;
        $container.append(listItem);
    });
    
    $('.memo-delete-btn').off('click').on('click', deleteCharMemo);
}


function deleteCharMemo(e) {
    const charIdToDelete = $(e.currentTarget).data('charId');
    const charName = $(e.currentTarget).closest('.memo-list-item').find('b').text();
    
    if (confirm(`정말로 '${charName}' 캐릭터의 메모와 모든 설정을 삭제하시겠습니까?`)) {
        
        delete settings.charData[charIdToDelete];
        
        if (this_chid === charIdToDelete) {
            $('#popup-memo-textarea').val('');
        }
        
        saveSettingsDebounced();
        
        renderCharMemoList();
        applySettings();
    }
}


function onSettingChange() {
    const charData = getCurrentCharData();
    
    settings.enabled = $('#memo_enable_toggle').prop('checked');
    settings.bgOpacity = parseFloat($('#memo_bg_opacity_input').val()) || 0.7;
    settings.bgImage = $('#memo_bg_image_input').val().trim();
    
    
    settings.charBubbleColor = $('#memo_char_bubble_color_input').val().trim() || '#FFFFFF';
    settings.userBubbleColor = $('#memo_user_bubble_color_input').val().trim() || '#F0F0F0';
    
    
    charData.userImageOverride = $('#memo_user_image_override').val().trim();

    
    settings.charBubbles = $('.memo-global-char-bubble-input').map(function() {
        return $(this).val();
    }).get();
    
    settings.userBubbles = $('.memo-global-user-bubble-input').map(function() {
        return $(this).val();
    }).get();
    
    
    charData.charBubbles = $('.memo-char-bubble-input').map(function() {
        return $(this).val();
    }).get();

    charData.userCharBubbles = $('.memo-user-char-bubble-input').map(function() {
        return $(this).val();
    }).get();

    charData.charImageOverride = $('#memo_char_image_override').val().trim();
    
    applySettings();
    saveSettingsDebounced();
}


function loadSettingsToUI() {
    const charData = getCurrentCharData();
    const charId = this_chid || 'no_char_selected';
    const charCard = characters[charId]; 
    const charName = charCard && charCard.name ? charCard.name : '캐릭터 미선택';

    $('#memo_enable_toggle').prop('checked', settings.enabled);
    $('#memo_bg_opacity_input').val(settings.bgOpacity);
    $('#memo_bg_image_input').val(settings.bgImage);
    
    
    $('#memo_char_bubble_color_input').val(settings.charBubbleColor);
    $('#memo_user_bubble_color_input').val(settings.userBubbleColor);
    
    $('#memo_char_bubble_color_input_text').val(settings.charBubbleColor);
    $('#memo_user_bubble_color_input_text').val(settings.userBubbleColor);
    
    
    $('#memo_user_image_override').val(charData.userImageOverride);
    $('#memo_char_image_override').val(charData.charImageOverride);

    
    settings.charBubbles.forEach((bubble, index) => {
        $(`#memo_global_char_bubble_${index + 1}`).val(bubble);
    });
    
    
    settings.userBubbles.forEach((bubble, index) => {
        $(`#memo_global_user_bubble_${index + 1}`).val(bubble);
    });
    
    
    $('#memo_individual_bubbles_drawer_title').text(`${charName} 개별 설정 오버라이드`);

    
    if (!charData.charBubbles) charData.charBubbles = ['', '', ''];
    charData.charBubbles.forEach((bubble, index) => {
        $(`#memo_char_bubble_${index + 1}`).val(bubble);
    });
    
    
    if (!charData.userCharBubbles) charData.userCharBubbles = ['', '', ''];
    charData.userCharBubbles.forEach((bubble, index) => {
        $(`#memo_user_char_bubble_${index + 1}`).val(bubble);
    });
    
    
    renderCharMemoList();
}


function onCharacterChange() {
    loadSettingsToUI(); 
    applySettings(); 
}





function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}






(async function() {
    
    settings = extension_settings.Popupmemo = extension_settings.Popupmemo || DEFAULT_SETTINGS;
    if (Object.keys(settings).length === 0) {
        settings = Object.assign(extension_settings.Popupmemo, DEFAULT_SETTINGS);
    }
    
    if (!settings.charBubbles) settings.charBubbles = DEFAULT_SETTINGS.charBubbles;
    if (!settings.userBubbles) settings.userBubbles = DEFAULT_SETTINGS.userBubbles;
    if (!settings.charBubbleColor) settings.charBubbleColor = DEFAULT_SETTINGS.charBubbleColor;
    if (!settings.userBubbleColor) settings.userBubbleColor = DEFAULT_SETTINGS.userBubbleColor;


    
    createMemoPopup();
    
    updateProfileImages();
    applySettings(); 

    
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
		$("#extensions_settings2").append(settingsHtml);

        
        $('#memo_enable_toggle, #memo_bg_opacity_input').on('change', onSettingChange);
        
        
        $('#memo_char_bubble_color_input, #memo_user_bubble_color_input').on('change', onSettingChange); 
        
        
        $('.memo-global-char-bubble-input, .memo-global-user-bubble-input, .memo-char-bubble-input, .memo-user-char-bubble-input').on('input', onSettingChange); 
        $('#memo_char_image_override, #memo_user_image_override').on('input', onSettingChange);

        $('#memo_apply_bg_btn').on('click', () => {
            onSettingChange();
            $('#memo_bg_image_input').blur();
        });

        
        $('#memo_reset_bubbles_btn').on('click', () => {
            if (confirm('모든 글로벌 말풍선 대사 내용을 초기화하시겠습니까? (캐릭터별 설정은 유지됩니다)')) {
                $('.memo-global-char-bubble-input').val('');
                $('.memo-global-user-bubble-input').val(''); 
                onSettingChange();
            }
        });

        loadSettingsToUI();

    } catch (error) {
        console.error(`[${extensionName}] Failed to load settings.html:`, error);
    }

    
    applySettings();

    
    eventSource.on(event_types.CHARACTER_SELECTED, onCharacterChange);
    eventSource.on(event_types.USER_AVATAR_UPDATED, updateProfileImages);
    
    eventSource.on(event_types.CHAT_CHANGED, () => {
        updateProfileImages(); 
        loadSettingsToUI();
        applySettings(); 
    });
    
    eventSource.on(event_types.SETTINGS_UPDATED, updateProfileImages);
})();