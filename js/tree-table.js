// tree table
function treeTable(table, setting) {
    // tableが既に対象のインスタンスを保有する場合
    if (table.treeObject) {
        return table.treeObject;
    }

    this.treeId = table.id;
    // table tag
    this.treeTable = table;
    // インスタンス保持
    this.treeTable.treeObject = this;
    // datas
    this.treeDatas;
    // storageが有効かチェック
    this.storageAvailable = function (type) {
        var storage;
        try {
            storage = window[type];
            var x = '__storage_test__';
            storage.setItem(x, x);
            storage.removeItem(x);
            return true;
        }
        catch (e) {
            return e instanceof DOMException && (
                // everything except Firefox
                e.code === 22 ||
                // Firefox
                e.code === 1014 ||
                // test name field too, because code might not be present
                // everything except Firefox
                e.name === 'QuotaExceededError' ||
                // Firefox
                e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
                // acknowledge QuotaExceededError only if there's something already stored
                (storage && storage.length !== 0);
        }
    };
    // default setting
    this.treeSetting = {
        // 初期表示時展開しているか
        isOpen: true,
        // 画面遷移しても開閉状態を維持するか
        isTreeStatusKeep: false,
        // ヘッダー
        headerLabels: [],
        // 描画順
        columns: [],
        // 階層識別列
        levelColumns: [],
        // 階層表示テキスト要素
        levelLabelIndex: 0,
        // 階層間隔 
        levelPadding: 20,
        // セル書込イベント
        onDrawCellValue: {
            // index: callback
            // column: function (value, cell ,rowData) { },
        },
        // 行描画イベント
        onDrawRow: function (row, rowData) { },
        // アイコンに表示するスタイル
        iconStyle: {
            openText: '+',
            openCss: 'tree-icon-open',
            closeText: '-',
            closeCss: 'tree-icon-close',
        }
    };
    // jsonコピー
    this.jsonValueCopy = function (baseSetting, copySetting, key) {
        if (baseSetting[key] != null) {
            baseSetting[key] = copySetting[key];
        } else {
            baseSetting.push({ key: copySetting[key] });
        }
    };
    // 設定コピー
    this.settingCopy = function (baseSetting, copySetting) {
        var mine = this;
        Object.keys(baseSetting).forEach(function (key) {
            if (copySetting[key] != null) {
                if (key == 'iconStyle') {
                    mine.settingCopy(baseSetting.iconStyle, copySetting.iconStyle);
                } else {
                    mine.jsonValueCopy(baseSetting, copySetting, key);
                }
            }
        });

        // 開閉状態をキープする場合、sessionStorageが使えるかチェックする
        if (this.treeSetting.isTreeStatusKeep) {
            this.treeSetting.isTreeStatusKeep = this.storageAvailable('sessionStorage');
        }
    };
    this.settingCopy(this.treeSetting, setting);

    // ツリー作成
    this.create = function (datas) {
        this.treeDatas = datas;

        // header要素を作成する場合
        if (this.treeSetting.headerLabels.length > 0) {
            this.treeTable.appendChild(this.createHeader());
        }

        this.createBody();
    };

    // ボディ作成
    this.createBody = function () {
        var mine = this;
        var body = document.createElement('tbody');
        this.treeDatas.forEach(function (rowData, index) {
            var levelKey = mine.getDispLevel(rowData);
            var row = mine.createRow(rowData, levelKey, mine.hasChild(levelKey.level, index));
            mine.treeSetting.onDrawRow(row, rowData);

            // sessionStorageにデータがあれば、こっちを優先
            var status = mine.getTreeRowDisp(row);
            if (status != null) {
                row.style.display = status == '1' ? '' : 'none';
            } else if (!mine.treeSetting.isOpen & levelKey.level > mine.treeSetting.levelLabelIndex) {
                row.style.display = 'none';
                mine.setTreeRowDisp(row, false);
            } else {
                mine.setTreeRowDisp(row, true);
            }
            body.appendChild(row);
        });
        this.treeTable.appendChild(body);
    };

    // ヘッダー作成 
    this.createHeader = function () {
        var thead = document.createElement('thead');
        thead.className = 'tree-header';
        var tr = document.createElement('tr');
        tr.className = 'tree-header-row';
        thead.appendChild(tr);

        // create header column
        this.treeSetting.headerLabels.forEach(function (value, index) {
            var td = document.createElement('td');
            var label = document.createElement('span');
            label.innerText = value;
            td.appendChild(label);
            tr.appendChild(td);
        });

        return thead;
    };

    // 子要素を持つか
    this.hasChild = function (level, index) {
        if (index + 1 < this.treeDatas.length) {
            var levelKey = this.getDispLevel(this.treeDatas[index + 1]);
            return level < levelKey.level;
        } else {
            return false;
        }
    };

    // 行作成
    this.createRow = function (rowData, levelKey, hasChild) {
        var row = document.createElement('tr');
        // tree-tableの属性設定
        row.setAttribute('disp-level', levelKey.level);
        row.setAttribute('disp-key', levelKey.key);
        var mine = this;
        // セル追加
        this.treeSetting.columns.forEach(function (value, index) {
            var cell = document.createElement('td');
            var cellText = document.createElement('span');
            cell.appendChild(cellText);
            // 該当列描画時、コールバックが設定されている場合
            if (mine.treeSetting.onDrawCellValue[value]) {
                mine.treeSetting.onDrawCellValue[value](rowData[value], cell, rowData);
            } else {
                cellText.innerText = rowData[value];
            }

            // 階層列描画時、スタイルを設定
            if (index == mine.treeSetting.levelLabelIndex) {
                // 開閉アイコンを追加
                var icon = mine.createIcon(hasChild, row);
                cell.insertBefore(icon, cell.firstChild);
                if (hasChild) {
                    // アイコンへの参照を保持
                    row.treeIcon = icon;
                }
                // 階層っぽく表現
                cell.style.paddingLeft = levelKey.level * mine.treeSetting.levelPadding + "px";
            }

            row.appendChild(cell);
        });

        return row;
    };

    // 表示階層取得
    this.getDispLevel = function (rowData) {
        var levelKey = {
            level: 0,
            key: '',
        };
        var keys = [];
        var cols = this.treeSetting.levelColumns;
        for (var i = 0; i < cols.length; i++) {
            // 子要素が無くなった時点の要素番目を返す
            if (!rowData[cols[i]]) {
                levelKey.level = i - 1;
                levelKey.key = keys.join('-');
                return levelKey;
            }
            keys.push(rowData[this.treeSetting.levelColumns[i]]);
        }

        levelKey.level = cols.length - 1;
        levelKey.key = keys.join('-');
        return levelKey;
    };

    // 開閉アイコン作成
    this.createIcon = function (hasChild, row) {
        var icon = document.createElement('div');
        var status = this.getTreeRowOpen(row);
        icon.className = 'tree-icon';
        // 子要素を持つ場合
        if (hasChild) {
            var flgOpen = status != null ? status == '1' : this.treeSetting.isOpen;
            this.setTreeRowOpen(row, flgOpen);
            var iconStyle = this.getIconStyle(flgOpen);
            icon.innerText = iconStyle.text;
            icon.className = iconStyle.css;
            icon.setAttribute('data-open', flgOpen ? "1" : "0");
            icon.treeTable = this;
            // アイコンクリックイベント設定
            icon.addEventListener('click', this.getIconClickEvent);
        }
        return icon;
    };

    // アイコンクリックイベント設定
    this.getIconClickEvent = function () {
        var flgOpen = this.getAttribute('data-open') == '1';
        this.setAttribute('data-open', flgOpen ? '0' : '1');
        var iconStyle = this.treeTable.getIconStyle(!flgOpen);
        this.innerText = iconStyle.text;
        this.className = iconStyle.css;
        var row = this.treeTable.getParentRow(this);
        this.treeTable.setTreeChildrenStyle(row, flgOpen);
        this.treeTable.setTreeRowOpen(row, !flgOpen);
    };

    // 子要素のスタイル設定
    this.setTreeChildrenStyle = function (parentRow, flgOpen) {
        var mine = this;
        var level = Number(parentRow.getAttribute('disp-level'));
        var childRow = parentRow.nextSibling;
        var childLevel = Number(childRow.getAttribute('disp-level'));

        var dispKey = this.getTargetDispKey(level, parentRow.getAttribute('disp-key'));
        var childDispKey = this.getTargetDispKey(level, childRow.getAttribute('disp-key'));

        var condition = function () {
            if (flgOpen) {
                // 開いている際の条件
                return level < childLevel;
            } else {
                // 閉じている際の条件
                return dispKey == childDispKey;
            }
        };
        // 行のスタイル、属性設定
        var setStyle = function () {
            childRow.style.display = flgOpen ? 'none' : '';
            if (childRow.treeIcon) {
                childRow.treeIcon.setAttribute('data-open', flgOpen ? '1' : '0');
                var iconStyle = mine.getIconStyle(flgOpen);
                childRow.treeIcon.innerText = iconStyle.text;
                childRow.treeIcon.className = iconStyle.css;
                // 開閉状態保存
                mine.setTreeRowOpen(childRow, false);
            }
            // sessiionStrageへ保存
            mine.setTreeRowDisp(childRow, !flgOpen);
        };

        while (condition()) {
            if (!flgOpen) {
                if (level == childLevel - 1) {
                    setStyle();
                }
            } else {
                setStyle();
            }
            childRow = childRow.nextSibling;
            if (!childRow)
                break;

            childLevel = Number(childRow.getAttribute('disp-level'));
            childDispKey = this.getTargetDispKey(level, childRow.getAttribute('disp-key'));
        }
    };

    // 対象階層のキー取得
    this.getTargetDispKey = function (level, dispKey) {
        var dispKeys = dispKey.split('-');
        var targetKeys = [];
        for (var i = 0; i <= level; i++) {
            targetKeys.push(dispKeys[i]);
        }

        return targetKeys.join('-');
    };

    // アイコンに表示するテキスト取得
    this.getIconStyle = function (isOpen) {
        if (isOpen) {
            return {
                text: this.treeSetting.iconStyle.openText,
                css: this.treeSetting.iconStyle.openCss + ' tree-icon',
            };
        } else {
            return {
                text: this.treeSetting.iconStyle.closeText,
                css: this.treeSetting.iconStyle.closeCss + ' tree-icon',
            };
        }
    };

    // 親行取得
    this.getParentRow = function (childElement) {
        var parent = childElement.parentNode;
        while (parent != null) {
            if (parent.tagName == 'TR') {
                return parent;
            }

            parent = parent.parentNode;
        }
    }

    // 破棄
    this.destroy = function () {
        // 親要素を取得しインスタンス、table要素破棄
        var parent = this.treeTable.parentNode;
        this.treeTable.treeObject = null;
        parent.removeChild(this.treeTable)
    };

    /// sessionStroge周りの処理

    // セッションに行の表示状態設定
    this.setTreeRowDisp = function (row, isDisp) {
        this.setSessionValue(row, 'disp', isDisp ? 1 : 0);
    };
    // セッションに行の開閉状態設定
    this.setTreeRowOpen = function (row, isOpen) {
        this.setSessionValue(row, 'open', isOpen ? 1 : 0);
    };

    // セッションから行の表示状態取得
    this.getTreeRowDisp = function (row) {
        return this.getSessionValue(row, 'disp');
    };

    // セッションから行の開閉状態取得
    this.getTreeRowOpen = function (row) {
        return this.getSessionValue(row, 'open');
    };

    // セッションに値設定
    this.setSessionValue = function (row, key, value) {
        if (this.treeSetting.isTreeStatusKeep) {
            var key = this.createSessionKey(row) + key;
            sessionStorage.setItem(key, value);
        }
    };

    // セッションから値取得
    this.getSessionValue = function (row, key) {
        if (this.treeSetting.isTreeStatusKeep) {
            var sessionKey = this.createSessionKey(row) + key;
            return sessionStorage.getItem(sessionKey);
        } else {
            return null;
        }
    };

    // セッションに使用するキー作成
    this.createSessionKey = function (row) {
        return this.treeId + "." + row.getAttribute('disp-key');
    };

}