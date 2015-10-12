#!/usr/bin/env python
# -*- coding: utf-8 -*-

###############################################################################
#  Copyright Kitware Inc.
#
#  Licensed under the Apache License, Version 2.0 ( the "License" );
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
###############################################################################
from girder.api import access
from girder.api.describe import Description
from girder.api.rest import loadmodel
from girder.constants import AccessType

from girder.plugins.minerva.rest.dataset import Dataset


class ElasticsearchDataset(Dataset):

    def __init__(self):
        self.resourceName = 'minerva_dataset_elasticsearch'
        self.route('POST', (), self.createElasticsearchDataset)

    @access.user
    @loadmodel(map={'elasticsearchSourceId': 'elasticsearchSource'},
               model='item', level=AccessType.READ)
    def createElasticsearchDataset(self, elasticsearchSource, params):
        minerva_meta = elasticsearchSource['meta']['minerva']
        baseURL = minerva_meta['elasticsearch_params']['base_url']

        if 'credentials' in minerva_meta['elasticsearch_params']:
            credentials = (minerva_meta['elasticsearch_params']['credentials'])
        else:
            credentials = None

        self.requireParams(('name'), params)
        name = params['name']
        minerva_metadata = {
            'dataset_type': 'elasticsearch',
            'datasetName': params['datasetName'],
            'source_id': elasticsearchSource['_id'],
            'base_url': baseURL
        }
        if credentials:
            minerva_metadata['credentials'] = credentials
        dataset = self.constructDataset(name, minerva_metadata)
        return dataset
    createElasticsearchDataset.description = (
        Description(('Create an Elasticsearch Dataset from '
                     'an Elasticsearch Source.'))
        .responseClass('Item')
        .param('name', 'The name of the Elasticsearch dataset', required=True)
        .param('elasticsearchSourceId',
               'Item ID of the Elasticsearch Source', required=True)
        .errorResponse('ID was invalid.')
        .errorResponse('Read permission denied on the Item.', 403))
