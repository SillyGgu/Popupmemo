import {
    eventSource,
    event_types,
    saveSettingsDebounced,
    characters,
    this_chid,
    getThumbnailUrl
} from '../../../../script.js';

import {
    getContext,
    extension_settings,
    loadExtensionSettings
} from '../../../extensions.js';

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

// 안전한 알림 함수 (toastr가 없어도 에러 안 나게 처리)
function showToast(type, message) {
    if (window.toastr && typeof window.toastr[type] === 'function') {
        window.toastr[type](message);
    } else {
        console.log(`[PopupMemo ${type}]: ${message}`);
    }
}

function createMemoPopup() {
    // 이미 존재하면 삭제 후 재생성 (중복 방지)
    $('#popup-memo-container').remove();

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
    
    console.log('[PopupMemo] DOM Created successfully.');
}

function bindDragFunctionality($element) {
    let isDragging = false;
    let offsetX, offsetY;
    const container = $element[0];

    if (!container) return; // 요소가 없으면 중단

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

        // 화면 밖으로 완전히 나가는 것 방지
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - 50));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - 50));

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
    if (!settings.charData) settings.charData = {}; // 방어 코드

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

    if ($memoContainer.length === 0) return; // 컨테이너가 없으면 중단

    $memoContainer.toggle(!!settings.enabled); // boolean으로 강제 변환하여 토글

    // 위치값 유효성 검사 및 복구
    if (!settings.pos || isNaN(settings.pos.top) || isNaN(settings.pos.left)) {
        console.log('[PopupMemo] 위치 설정이 잘못되어 초기화합니다.');
        settings.pos = { top: 50, left: 50 };
    }

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
    
    // bubbles가 undefined이거나 배열이 아닐 경우 방어
    if (!Array.isArray(bubbles)) return { timer: null, index: 0 };

    const validBubbles = bubbles.filter(b => b && b.trim() !== '');

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

// Debounce 함수 정의
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
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

    if (!settings.charData) return;

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
        const memoPreview = firstLine.substring(0, 40) + (firstLine.length > 40 || data.memoContent.split('\n').length > 1 ? '...' : '');

        const listItem = `
            <div class="memo-list-item" data-char-id="${charId}">
                <div class="memo-list-item-content" title="${data.memoContent}">
                    <b>${charName}</b>: ${memoPreview}
                </div>
                <div class="memo-btn-group">
                    <button class="memo-copy-btn" data-char-id="${charId}" title="메모 내용 복사">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                    <button class="memo-migrate-btn" data-char-id="${charId}" title="현재 캐릭터로 데이터 이동 (ID 변경)">
                        <i class="fa-solid fa-file-import"></i>
                    </button>
                    <button class="memo-delete-btn" data-char-id="${charId}" title="메모 삭제">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
        $container.append(listItem);
    });
    
    // 이벤트 바인딩
    $('.memo-copy-btn').off('click').on('click', copyCharMemo);
    $('.memo-migrate-btn').off('click').on('click', migrateCharMemo);
    $('.memo-delete-btn').off('click').on('click', deleteCharMemo);
}

// 메모 복사 기능
function copyCharMemo(e) {
    const charId = $(e.currentTarget).data('charId');
    const data = settings.charData[charId];
    
    if (data && data.memoContent) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(data.memoContent).then(() => {
                showToast('success', '메모 내용이 클립보드에 복사되었습니다.');
            }).catch(err => {
                console.error('클립보드 복사 실패:', err);
                showToast('error', '복사에 실패했습니다. 콘솔을 확인해주세요.');
            });
        } else {
            showToast('warning', '클립보드 API를 사용할 수 없는 환경입니다.');
        }
    }
}

// 데이터 ID 변경 (이동) 기능
function migrateCharMemo(e) {
    const oldCharId = $(e.currentTarget).data('charId');
    const oldCharName = $(e.currentTarget).closest('.memo-list-item').find('b').text();
    
    if (!this_chid) {
        showToast('warning', '현재 선택된 캐릭터가 없습니다. 캐릭터를 먼저 선택해주세요.');
        return;
    }

    if (oldCharId === this_chid) {
        showToast('info', '이미 현재 선택된 캐릭터의 데이터입니다.');
        return;
    }

    const currentName = characters[this_chid] ? characters[this_chid].name : '현재 캐릭터';

    if (confirm(`'${oldCharName}'의 메모 데이터를 현재 캐릭터('${currentName}')로 이동하시겠습니까?\n\n주의: 현재 캐릭터의 기존 메모가 있다면 덮어씌워집니다.`)) {
        
        // 데이터 깊은 복사
        settings.charData[this_chid] = JSON.parse(JSON.stringify(settings.charData[oldCharId]));
        
        // 기존(잘못된 ID) 데이터 삭제
        delete settings.charData[oldCharId];
        
        saveSettingsDebounced();
        applySettings();
        loadSettingsToUI(); // UI 갱신 (리스트 포함)
        
        showToast('success', `데이터가 '${currentName}'에게로 이동되었습니다.`);
    }
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

// 메인 실행부
(async function() {
    console.log('[PopupMemo] Extension loading...');

    try {
        // 1. 설정 초기화
        settings = extension_settings.Popupmemo = extension_settings.Popupmemo || DEFAULT_SETTINGS;
        if (Object.keys(settings).length === 0) {
            settings = Object.assign(extension_settings.Popupmemo, DEFAULT_SETTINGS);
        }
        
        // 기본값 보정
        if (!settings.charBubbles) settings.charBubbles = DEFAULT_SETTINGS.charBubbles;
        if (!settings.userBubbles) settings.userBubbles = DEFAULT_SETTINGS.userBubbles;
        if (!settings.charBubbleColor) settings.charBubbleColor = DEFAULT_SETTINGS.charBubbleColor;
        if (!settings.userBubbleColor) settings.userBubbleColor = DEFAULT_SETTINGS.userBubbleColor;
        if (!settings.pos) settings.pos = { top: 50, left: 50 }; // 위치 초기화

        // 2. DOM 생성
        createMemoPopup();
        updateProfileImages();
        
        // 3. 설정 HTML 로드 (비동기)
        try {
            const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
            $("#extensions_settings2").append(settingsHtml);

            // 이벤트 바인딩
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

        // 4. 최종 적용
        applySettings();

        // 5. 이벤트 리스너 등록
        eventSource.on(event_types.CHARACTER_SELECTED, onCharacterChange);
        eventSource.on(event_types.USER_AVATAR_UPDATED, updateProfileImages);
        
        eventSource.on(event_types.CHAT_CHANGED, () => {
            updateProfileImages(); 
            loadSettingsToUI();
            applySettings(); 
        });
        
        eventSource.on(event_types.SETTINGS_UPDATED, updateProfileImages);
        
        console.log('[PopupMemo] Extension loaded successfully.');

    } catch (e) {
        console.error('[PopupMemo] Critical Error during initialization:', e);
    }
})();