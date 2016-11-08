minerva.views.DataPanel = minerva.views.Panel.extend({
    events: {
        // TODO namespace.
        'click .add-dataset-to-session': 'addDatasetToSessionEvent',
        'click .m-upload-local': 'uploadDialog',
        'click .m-add-wms': 'addWmsDataset',
        'click .delete-dataset': 'deleteDatasetEvent',
        'click .m-display-dataset-table': 'displayTableDataset',
        'click .dataset-info': 'displayDatasetInfo',
        'click .m-configure-geo-render': 'configureGeoRender',
        'click .source-title': 'toggleDatasets',
        'click .m-configure-wms-styling': 'styleWmsDataset'
    },
    getDatasetModel: function () {
        return this.parentView.parentView.model;
    },
    toggleDatasets: function (event) {
        var listOfLayers = $(event.currentTarget).next();

        if (listOfLayers.css('display') === 'none') {
            listOfLayers.css('display', 'block');
            this.visibleSourceGroups[$(event.currentTarget).text()] = true;
            $(event.currentTarget).find('i.icon-folder').attr('class', 'icon-folder-open');
            this.getDatasetModel().addLayoutAttributes(event.target.id, {
                closed: false
            });
        } else {
            listOfLayers.css('display', 'none');
            this.visibleSourceGroups[$(event.currentTarget).text()] = false;
            $(event.currentTarget).find('i.icon-folder-open').attr('class', 'icon-folder');
            this.getDatasetModel().addLayoutAttributes(event.target.id, {
                closed: true
            });
        }
    },
    addWmsDataset: function (event) {
        var addWmsWidget = new minerva.views.AddWmsSourceWidget({
            el: $('#g-dialog-container'),
            collection: this.collection,
            parentView: this
        });
        addWmsWidget.render();
    },

    // Ability to style a wms layer
    styleWmsDataset: function (event) {
        var datasetId = $(event.currentTarget).attr('m-dataset-id');
        var dataset = this.collection.get(datasetId);
        var styleWmsWidget = new minerva.views.StyleWmsDatasetWidget({
            el: $('#g-dialog-container'),
            collection: this.collection,
            dataset: dataset,
            parentView: this
        });
        styleWmsWidget.render();
    },

    /**
     * Displays the selected dataset's tabular data in a CSV viewer widget.
     */
    displayTableDataset: function (event) {
        var datasetId = $(event.currentTarget).attr('m-dataset-id');
        var dataset = this.collection.get(datasetId);
        dataset.on('m:dataset_table_dataLoaded', function () {
            new minerva.views.CsvViewerWidget({
                el: $('#g-dialog-container'),
                collection: this.collection,
                parentView: this,
                dataset: dataset,
                data: dataset.get('tableData')
            }).render();
        }, this).loadTabularData();
    },

    /**
     * Display a modal dialog allowing configuration of GeoJs rendering
     * properties for the selected dataset.
     */
    configureGeoRender: function (event) {
        var datasetId = $(event.currentTarget).attr('m-dataset-id');
        var dataset = this.collection.get(datasetId);
        var geoRenderType = dataset.getGeoRenderType();
        if (dataset.get('displayed') || geoRenderType === null) {
            // Don't pop up the modal when the dataset is active,
            // or it can't be configured.
            return;
        }
        var configureWidgets = {
            'choropleth': minerva.views.ChoroplethRenderWidget,
            'geojson': minerva.views.JsonConfigWidget,
            'contour': minerva.views.JsonConfigWidget
        };
        if (!this.configureWidgets) {
            this.configureWidgets = {};
        }
        if (!this.configureWidgets[geoRenderType]) {
            this.configureWidgets[geoRenderType] = new (configureWidgets[geoRenderType])({
                el: $('#g-dialog-container'),
                dataset: dataset,
                parentView: this
            });
            this.configureWidgets[geoRenderType].render();
        } else {
            this.configureWidgets[geoRenderType].setCurrentDataset(dataset);
        }
    },

    /**
     * Displays a dialog allowing the user to upload files, that will become
     * Datasets.
     */
    uploadDialog: function () {
        var container = $('#g-dialog-container');

        this.uploadWidget = new girder.views.UploadWidget({
            el: container,
            noParent: true,
            title: 'Upload a dataset',
            overrideStart: true,
            parentView: this.parentView
        }).on('g:uploadFinished', function () {
            this.upload = false;
        }, this).render();
        this.listenTo(this.uploadWidget, 'g:uploadStarted', this.uploadStarted);
        this.listenTo(this.uploadWidget, 'g:uploadFinished', this.uploadFinished);
    },

    /**
     * Create a new Item for the dataset, then upload all files there.
     */
    uploadStarted: function () {
        this.newDataset = new minerva.models.DatasetModel({
            name: _.first(this.uploadWidget.files).name,
            folderId: this.collection.folderId
        }).on('g:saved', function () {
            this.uploadWidget.parentType = 'item';
            this.uploadWidget.parent = this.newDataset;
            this.uploadWidget.uploadNextFile();
        }, this).on('g:error', function (err) {
            console.error(err);
        }).save();
    },

    /**
     * Promote an Item to a Dataset, then add it to the DatasetCollection.
     */
    uploadFinished: function () {
        var params = {};
        // If the file is csv, parse the first 10 rows and save in minerva metadata
        if (this.uploadWidget.files &&
            this.uploadWidget.files.length > 0 &&
            this.uploadWidget.files[0].type === 'text/csv') {
            var ROWS_PREVIEW = 10;
            if (typeof (FileReader) !== 'undefined') {
                var reader = new FileReader();
                reader.onload = function (e) {
                    // get file content
                    var csv = e.target.result;
                    var parsedCSV = Papa.parse(csv, { skipEmptyLines: true, header: true, preview: ROWS_PREVIEW });
                    if (parsedCSV.data) {
                        params.csvPreview = parsedCSV.data;
                    }
                };
                reader.readAsText(this.uploadWidget.files[0]);
            } else {
                alert('This browser does not support HTML5.');
            }
        }
        this.newDataset.on('m:dataset_promoted', function () {
            this.collection.add(this.newDataset);
        }, this).on('g:error', function (err) {
            console.error(err);
        }).promoteToDataset(params);
    },

    addDatasetToSessionEvent: function (event) {
        var datasetId = $(event.currentTarget).attr('m-dataset-id'),
            dataset = this.collection.get(datasetId),
            stackValues = _.invoke(this.collection.models, 'get', 'stack'),
            lastValueInStack = _.max(stackValues);

        if (!dataset.get('displayed')) {
            dataset.set('stack', lastValueInStack + 1);
            // TODO maybe this check is unnecessary, how can we get into this state?
            dataset.set('displayed', true);
        }
    },

    deleteDatasetEvent: function (event) {
        if ($(event.currentTarget).hasClass('icon-disabled')) {
            return;
        } else {
            var datasetId = $(event.currentTarget).attr('m-dataset-id');
            var dataset = this.collection.get(datasetId);
            dataset.destroy();
            this.collection.remove(dataset);
        }
    },

    displayDatasetInfo: function (event) {
        var datasetId = $(event.currentTarget).attr('m-dataset-id');
        var dataset = this.collection.get(datasetId);
        this.datasetInfoWidget = new minerva.views.DatasetInfoWidget({
            el: $('#g-dialog-container'),
            dataset: dataset,
            parentView: this
        });
        this.datasetInfoWidget.render();
    },
    initialize: function (settings) {
        var externalId = 1;
        this.collection = settings.session.datasetsCollection;
        this.visibleSourceGroups = {};
        this.listenTo(this.collection, 'g:changed', function () {
            this.render();
        }, this).listenTo(this.collection, 'change', function () {
            this.render();
        }, this).listenTo(this.collection, 'change:meta', function () {
            this.render();
        }, this).listenTo(this.collection, 'change:displayed', function () {
            this.render();
        }, this).listenTo(this.collection, 'add', function () {
            this.render();
        }, this).listenTo(this.collection, 'remove', function () {
            this.render();
        }, this).listenTo(minerva.events, 'm:updateDatasets', function () {
            this.collection.fetch(undefined, true);
        }, this).listenTo(minerva.events, 'm:addExternalGeoJSON', function (options) {
            if (!options || !options.data) {
                console.warn('Invalid external geojson');
                return;
            }
            var dataset = new minerva.models.DatasetModel({
                _id: externalId++,
                name: options.name || 'External GeoJSON',
                folderId: options.folderId || this.collection.folderId
            });
            dataset.set({
                meta: {
                    minerva: {
                        dataset_type: 'geojson',
                        original_type: 'geojson',
                        geo_render: {
                            type: 'geojson'
                        },
                        geojson: {
                            data: options.data
                        },
                        source: {
                            layer_source: 'GeoJSON',
                            source_type: 'geojson'
                        }
                    }
                }
            });

            // these datasets are temporary, so these are noops
            dataset.sync = function () {};
            dataset.fetch = function () {};
            dataset.save = function () {};
            dataset.destroy = function () {};

            dataset.saveMinervaMetadata = function (mm) {
                if (mm) {
                    dataset.setMinervaMetadata(mm);
                }
                return dataset;
            };

            this.collection.add(dataset);
        }, this);

        girder.eventStream.on('g:event.job_status', _.bind(function (event) {
            var status = window.parseInt(event.data.status);
            if (status === girder.jobs_JobStatus.SUCCESS) {
                if (event.data && event.data.meta && event.data.meta.minerva &&
                   event.data.meta.minerva.outputs && event.data.meta.minerva.outputs.length > 0 &&
                   event.data.meta.minerva.outputs[0].dataset_id) {
                    var datasetId = event.data.meta.minerva.outputs[0].dataset_id;
                    var dataset = new minerva.models.DatasetModel({ _id: datasetId });
                    dataset.on('g:fetched', function () {
                        this.collection.add(dataset);
                    }, this).fetch();
                }
            }
        }, this));

        minerva.views.Panel.prototype.initialize.apply(this);
    },

    getSourceNameFromModel: function (model) {
        return (((model.get('meta') || {}).minerva || {}).source || {}).layer_source;
    },

    render: function () {
        this.sourceDataset = _.groupBy(
            _.filter(this.collection.models, this.getSourceNameFromModel),
            this.getSourceNameFromModel
        );

        this.$el.html(minerva.templates.dataPanel({
            sourceDatasetMapping: this.sourceDataset,
            visibleSourceGroups: this.visibleSourceGroups,
            sourceNames: _.keys(this.sourceDataset).sort(girder.localeSort)
        }));

        var model = this.getDatasetModel();

        // Restore state of collapsed sources
        if (_.has(model.metadata(), 'layout')) {
            _.each(model.metadata().layout, function (source, sourceId) {
                if (_.has(source, 'closed') && source.closed === false) {
                    $('#' + sourceId).find('i.icon-folder').toggleClass('icon-folder icon-folder-open');
                }
            }, this);
        }

        // TODO pagination and search?
        return this;
    }

});
